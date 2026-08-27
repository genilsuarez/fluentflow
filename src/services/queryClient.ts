import { QueryClient } from '@tanstack/react-query';

// Optimized QueryClient configuration — exported as a singleton so non-React
// code (api.ts's progressive module-catalog loader) can read/write the same
// cache the app's hooks use, instead of re-fetching independently.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // Keep unused data in cache 30 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          return false;
        }
        // Don't retry JSON parse errors (content issue, not transient)
        if (error instanceof Error && error.message.includes('parse JSON')) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      // Don't auto-refetch on reconnect — user can manually refresh if needed.
      // Auto-refetch on reconnect can cause the UI to flash/error when coming
      // back to the page after a long time if the network request fails.
      refetchOnReconnect: false,
      // Allow queries to run even when offline - let service worker handle it
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});
