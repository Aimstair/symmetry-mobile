/**
 * useAccurateTimer - Drift-Proof Timer Hook
 * 
 * Uses the "Delta" method to guarantee the timer finishes exactly on time,
 * even if the app lags, is backgrounded, or experiences frame drops.
 * 
 * Instead of counting down each second, it calculates when the timer SHOULD end
 * and compares against the current time. This means the timer "catches up" instantly
 * if the app was paused or lagged.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAccurateTimerReturn {
  /** Seconds remaining on the timer */
  secondsRemaining: number;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Start the timer from current secondsRemaining */
  start: () => void;
  /** Pause the timer (preserves remaining time) */
  pause: () => void;
  /** Reset the timer to a new duration */
  reset: (newSeconds: number) => void;
  /** Add time to the current timer */
  addTime: (seconds: number) => void;
}

export const useAccurateTimer = (
  initialSeconds: number,
  onComplete?: () => void
): UseAccurateTimerReturn => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  
  // Store the exact timestamp when timer should complete
  const endTimeRef = useRef<number | null>(null);
  
  // Store onComplete in ref to avoid stale closures
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = useCallback(() => {
    if (secondsRemaining <= 0) return;
    
    // Calculate exactly when the timer SHOULD end
    endTimeRef.current = Date.now() + secondsRemaining * 1000;
    setIsRunning(true);
  }, [secondsRemaining]);

  const pause = useCallback(() => {
    if (isRunning && endTimeRef.current) {
      // Preserve the remaining time when pausing
      const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      setSecondsRemaining(Math.max(0, remaining));
    }
    setIsRunning(false);
    endTimeRef.current = null;
  }, [isRunning]);

  const reset = useCallback((newSeconds: number) => {
    setIsRunning(false);
    setSecondsRemaining(newSeconds);
    endTimeRef.current = null;
  }, []);

  const addTime = useCallback((seconds: number) => {
    if (isRunning && endTimeRef.current) {
      // Extend the end time
      endTimeRef.current += seconds * 1000;
      const newRemaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      setSecondsRemaining(Math.max(0, newRemaining));
    } else {
      // Not running - just add to the remaining time
      setSecondsRemaining((prev) => Math.max(0, prev + seconds));
    }
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || !endTimeRef.current) return;

    // Check 4x per second to ensure UI feels snappy
    // This is more efficient than checking every frame
    const interval = setInterval(() => {
      const now = Date.now();
      const left = Math.ceil((endTimeRef.current! - now) / 1000);

      if (left <= 0) {
        setSecondsRemaining(0);
        setIsRunning(false);
        endTimeRef.current = null;
        
        // Call onComplete callback
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
        
        clearInterval(interval);
      } else {
        // This effectively "skips" frames if the app lagged, catching up instantly
        setSecondsRemaining(left);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning]);

  return { 
    secondsRemaining, 
    isRunning, 
    start, 
    pause, 
    reset,
    addTime,
  };
};

export default useAccurateTimer;
