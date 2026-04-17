/**
 * Video Caching Utility
 * 
 * Caches remote video files locally for faster loading and offline access.
 * Uses expo-file-system for file management.
 */

import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';

// Cache directory for videos
const VIDEO_CACHE_DIR = `${FileSystem.cacheDirectory}exercise-videos/`;
const inFlightDownloads = new Map<string, Promise<string | null>>();

/**
 * Generate a consistent filename from a URL
 */
function getFilenameFromUrl(url: string): string {
  // Create a hash of the URL for consistent naming
  const urlHash = url.split('/').pop()?.split('?')[0] || 'video';
  return urlHash.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIR, { intermediates: true });
  }
}

/**
 * Get cached video path if it exists
 */
async function getCachedVideoPath(url: string): Promise<string | null> {
  const filename = getFilenameFromUrl(url);
  const localPath = `${VIDEO_CACHE_DIR}${filename}`;
  
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }
  } catch (error) {
    console.error('Error checking cached video:', error);
  }
  
  return null;
}

/**
 * Download video to cache
 */
async function cacheVideo(url: string): Promise<string | null> {
  const existingDownload = inFlightDownloads.get(url);
  if (existingDownload) {
    return existingDownload;
  }

  await ensureCacheDirectory();

  const downloadPromise = (async () => {
    const filename = getFilenameFromUrl(url);
    const localPath = `${VIDEO_CACHE_DIR}${filename}`;

    try {
      const localInfo = await FileSystem.getInfoAsync(localPath);
      if (localInfo.exists) {
        return localPath;
      }

      const downloadResult = await FileSystem.downloadAsync(url, localPath);

      if (downloadResult.status === 200) {
        if (__DEV__) {
          console.log('📹 Video cached successfully:', filename);
        }
        return downloadResult.uri;
      }
    } catch (error) {
      console.error('Error caching video:', error);
    }

    return null;
  })();

  inFlightDownloads.set(url, downloadPromise);

  try {
    return await downloadPromise;
  } finally {
    inFlightDownloads.delete(url);
  }
}

/**
 * Clear video cache
 */
export async function clearVideoCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(VIDEO_CACHE_DIR, { idempotent: true });
    }
  } catch (error) {
    console.error('Error clearing video cache:', error);
  }
}

/**
 * Get cache size in bytes
 */
export async function getVideoCacheSize(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
    if (!dirInfo.exists) return 0;

    const files = await FileSystem.readDirectoryAsync(VIDEO_CACHE_DIR);
    const fileInfos = await Promise.all(
      files.map((file) => FileSystem.getInfoAsync(`${VIDEO_CACHE_DIR}${file}`))
    );

    return fileInfos.reduce((total, fileInfo) => {
      if (!fileInfo.exists || !('size' in fileInfo) || !fileInfo.size) {
        return total;
      }
      return total + fileInfo.size;
    }, 0);
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
}

/**
 * Hook: Get cached video URI
 * 
 * Returns the cached local URI if available, otherwise returns the remote URL
 * and downloads the video in the background for next time.
 * 
 * @param remoteUrl - The remote video URL
 * @returns { uri: string | null, isLocal: boolean, isLoading: boolean }
 */
export function useCachedVideo(remoteUrl: string | null | undefined): {
  uri: string | null;
  isLocal: boolean;
  isLoading: boolean;
} {
  const [uri, setUri] = useState<string | null>(remoteUrl || null);
  const [isLocal, setIsLocal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!remoteUrl) {
      setUri(null);
      setIsLocal(false);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const loadVideo = async () => {
      setIsLoading(true);
      
      try {
        // Check if video is already cached
        const cachedPath = await getCachedVideoPath(remoteUrl);
        
        if (cachedPath) {
          if (mounted) {
            setUri(cachedPath);
            setIsLocal(true);
            setIsLoading(false);
          }
          return;
        }
        
        // Not cached - return remote URL immediately
        if (mounted) {
          setUri(remoteUrl);
          setIsLocal(false);
          setIsLoading(false);
        }
        
        // Download in background for next time
        cacheVideo(remoteUrl).then((localPath) => {
          if (mounted && localPath) {
            // Update to local path once cached
            setUri(localPath);
            setIsLocal(true);
          }
        });
        
      } catch (error) {
        console.error('Error in useCachedVideo:', error);
        if (mounted) {
          setUri(remoteUrl);
          setIsLocal(false);
          setIsLoading(false);
        }
      }
    };

    loadVideo();

    return () => {
      mounted = false;
    };
  }, [remoteUrl]);

  return { uri, isLocal, isLoading };
}

/**
 * Preload videos into cache
 * Call this during app startup or when entering workout screens
 */
export async function preloadVideos(urls: string[]): Promise<void> {
  await ensureCacheDirectory();

  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  const cachedPaths = await Promise.all(uniqueUrls.map((url) => getCachedVideoPath(url)));
  const uncachedUrls = uniqueUrls.filter((_, index) => !cachedPaths[index]);
  
  if (__DEV__ && uncachedUrls.length > 0) {
    console.log(`📹 Preloading ${uncachedUrls.length} videos...`);
  }
  
  // Download uncached videos in parallel (limit concurrency)
  const batchSize = 3;
  for (let i = 0; i < uncachedUrls.length; i += batchSize) {
    const batch = uncachedUrls.slice(i, i + batchSize);
    await Promise.all(batch.map(cacheVideo));
  }
}
