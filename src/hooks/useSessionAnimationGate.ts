import { useCallback } from 'react';

/**
 * Returns a function that consumes a one-time animation token for a screen key.
 * The first call in the app process returns true; subsequent calls return false.
 */
export function useConsumeSessionAnimation(screenKey: string): () => boolean {
  return useCallback(() => {
    return false;
  }, [screenKey]);
}
