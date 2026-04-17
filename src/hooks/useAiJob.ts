/**
 * useAiJob - Hook for managing AI analysis job lifecycle
 * 
 * Features:
 * - Create new AI analysis jobs
 * - Poll job status with Supabase Realtime (with fallback to interval polling)
 * - Clean up subscriptions on unmount
 * 
 * Usage:
 * ```tsx
 * const { createJob, jobStatus, result, error, isLoading } = useAiJob();
 * 
 * const handleScan = async (imagePath: string) => {
 *   const jobId = await createJob(imagePath);
 *   // Hook will automatically track status changes
 * };
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/NotificationService';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type AiJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'idle';

export interface AiJobResult {
  muscleScores?: {
    chest: number;
    back: number;
    shoulders: number;
    arms: number;
    legs: number;
  };
  symmetryScore?: number;
  recommendations?: string[];
  [key: string]: any; // Allow additional fields
}

export interface AiJob {
  id: string;
  status: AiJobStatus;
  imagePath: string;
  result: AiJobResult | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface UseAiJobOptions {
  /** Polling interval in ms (used as fallback if realtime fails) */
  pollingInterval?: number;
  /** Whether to use realtime subscriptions (recommended) */
  useRealtime?: boolean;
  /** Callback when job completes successfully */
  onComplete?: (result: AiJobResult) => void;
  /** Callback when job fails */
  onError?: (error: string) => void;
}

export interface UseAiJobReturn {
  /** Create a new AI analysis job */
  createJob: (imagePath: string) => Promise<string | null>;
  /** Current job ID being tracked */
  jobId: string | null;
  /** Current job status */
  status: AiJobStatus;
  /** Result from completed job */
  result: AiJobResult | null;
  /** Error message if job failed */
  error: string | null;
  /** Whether a job is currently being processed */
  isLoading: boolean;
  /** Reset the hook state */
  reset: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_POLLING_INTERVAL = 3000; // 3 seconds
const MAX_POLLING_ATTEMPTS = 100; // ~5 minutes at 3s intervals

// ============================================================================
// HOOK: useAiJob
// ============================================================================

export function useAiJob(options: UseAiJobOptions = {}): UseAiJobReturn {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    useRealtime = true,
    onComplete,
    onError,
  } = options;

  // State
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<AiJobStatus>('idle');
  const [result, setResult] = useState<AiJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingAttemptsRef = useRef(0);

  /**
   * Clean up subscriptions and polling
   */
  const cleanup = useCallback(() => {
    // Unsubscribe from realtime channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    pollingAttemptsRef.current = 0;
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    cleanup();
    setJobId(null);
    setStatus('idle');
    setResult(null);
    setError(null);
  }, [cleanup]);

  /**
   * Fetch job status from database
   */
  const fetchJobStatus = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_job_status', { p_job_id: id });

      if (fetchError) {
        if (__DEV__) console.error('Failed to fetch job status:', fetchError);
        return false;
      }

      if (data && data.length > 0) {
        const job = data[0];
        setStatus(job.status);

        if (job.status === 'completed' && job.result_json) {
          setResult(job.result_json);
          await notificationService.scheduleAiCompletionFallback({ jobId: id, delaySeconds: 1 });
          cleanup();
          onComplete?.(job.result_json);
          return true; // Job finished
        }

        if (job.status === 'failed') {
          setError(job.error_message || 'Analysis failed');
          cleanup();
          onError?.(job.error_message || 'Analysis failed');
          return true; // Job finished (with error)
        }
      }

      return false; // Job still in progress
    } catch (err) {
      if (__DEV__) console.error('Error fetching job status:', err);
      return false;
    }
  }, [cleanup, onComplete, onError]);

  /**
   * Start polling for job status (fallback)
   */
  const startPolling = useCallback((id: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingAttemptsRef.current = 0;

    pollingIntervalRef.current = setInterval(async () => {
      pollingAttemptsRef.current++;

      // Check if we've exceeded max attempts
      if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
        if (__DEV__) console.warn('AI job polling exceeded max attempts');
        setError('Analysis timed out. Please try again.');
        setStatus('failed');
        cleanup();
        onError?.('Analysis timed out. Please try again.');
        return;
      }

      const finished = await fetchJobStatus(id);
      if (finished) {
        // Job is done, interval will be cleared in cleanup
      }
    }, pollingInterval);
  }, [pollingInterval, fetchJobStatus, cleanup, onError]);

  /**
   * Subscribe to realtime updates for job
   */
  const subscribeToJob = useCallback((id: string) => {
    // Clean up any existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`ai_job_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_analysis_jobs',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          
          if (__DEV__) {
            console.log('🔔 AI Job update:', newRecord.status);
          }

          setStatus(newRecord.status);

          if (newRecord.status === 'completed' && newRecord.result_json) {
            setResult(newRecord.result_json);
            void notificationService.scheduleAiCompletionFallback({ jobId: id, delaySeconds: 1 });
            cleanup();
            onComplete?.(newRecord.result_json);
          }

          if (newRecord.status === 'failed') {
            setError(newRecord.error_message || 'Analysis failed');
            cleanup();
            onError?.(newRecord.error_message || 'Analysis failed');
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (__DEV__) console.log('📡 Subscribed to AI job updates');
        } else if (status === 'CHANNEL_ERROR') {
          // Fallback to polling if realtime fails
          if (__DEV__) console.warn('Realtime subscription failed, falling back to polling');
          startPolling(id);
        }
      });

    channelRef.current = channel;
  }, [cleanup, onComplete, onError, startPolling]);

  /**
   * Create a new AI analysis job
   */
  const createJob = useCallback(async (imagePath: string): Promise<string | null> => {
    // Reset state for new job
    reset();
    setStatus('pending');

    try {
      const { data, error: createError } = await supabase
        .rpc('create_analysis_job', { p_image_path: imagePath });

      if (createError) {
        if (__DEV__) console.error('Failed to create AI job:', createError);
        setError('Failed to start analysis');
        setStatus('failed');
        return null;
      }

      const newJobId = data as string;
      setJobId(newJobId);

      if (__DEV__) {
        console.log('🚀 Created AI analysis job:', newJobId);
      }

      // Start tracking job status
      if (useRealtime) {
        subscribeToJob(newJobId);
        // Also start polling as a backup (will be cleared if realtime works)
        setTimeout(() => {
          if (channelRef.current === null) {
            startPolling(newJobId);
          }
        }, 5000);
      } else {
        startPolling(newJobId);
      }

      return newJobId;
    } catch (err) {
      if (__DEV__) console.error('Error creating AI job:', err);
      setError('Failed to start analysis');
      setStatus('failed');
      return null;
    }
  }, [reset, useRealtime, subscribeToJob, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    createJob,
    jobId,
    status,
    result,
    error,
    isLoading: status === 'pending' || status === 'processing',
    reset,
  };
}

// ============================================================================
// HOOK: useJobStatus (for tracking an existing job)
// ============================================================================

export interface UseJobStatusOptions {
  /** Polling interval in ms */
  pollingInterval?: number;
  /** Whether to use realtime subscriptions */
  useRealtime?: boolean;
}

export interface UseJobStatusReturn {
  status: AiJobStatus;
  result: AiJobResult | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to track status of an existing AI job
 */
export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
): UseJobStatusReturn {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    useRealtime = true,
  } = options;

  const [status, setStatus] = useState<AiJobStatus>('idle');
  const [result, setResult] = useState<AiJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_job_status', { p_job_id: jobId });

      if (fetchError) {
        if (__DEV__) console.error('Failed to fetch job status:', fetchError);
        return;
      }

      if (data && data.length > 0) {
        const job = data[0];
        setStatus(job.status);
        
        if (job.result_json) {
          setResult(job.result_json);
        }
        
        if (job.error_message) {
          setError(job.error_message);
        }

        // Stop tracking if job is finished
        if (job.status === 'completed' || job.status === 'failed') {
          cleanup();
        }
      }
    } catch (err) {
      if (__DEV__) console.error('Error fetching job status:', err);
    }
  }, [jobId, cleanup]);

  // Set up tracking when jobId changes
  useEffect(() => {
    if (!jobId) {
      setStatus('idle');
      setResult(null);
      setError(null);
      return;
    }

    // Initial fetch
    fetchStatus();

    if (useRealtime) {
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`ai_job_status_${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'ai_analysis_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const newRecord = payload.new as any;
            setStatus(newRecord.status);
            if (newRecord.result_json) setResult(newRecord.result_json);
            if (newRecord.error_message) setError(newRecord.error_message);
            
            if (newRecord.status === 'completed' || newRecord.status === 'failed') {
              cleanup();
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    } else {
      // Fallback to polling
      pollingIntervalRef.current = setInterval(fetchStatus, pollingInterval);
    }

    return () => {
      cleanup();
    };
  }, [jobId, useRealtime, pollingInterval, fetchStatus, cleanup]);

  return {
    status,
    result,
    error,
    isLoading: status === 'pending' || status === 'processing',
    refetch: fetchStatus,
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useAiJob;
