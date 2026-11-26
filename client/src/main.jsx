import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import './styles.css';

// Moving between pages reuses what was already loaded instead of asking the server again.
// Anything that changes data invalidates the queries it affects, so this never shows a
// stale number after a save; it only stops re-fetching the same thing on every page switch.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // fresh for a minute: switching tabs within it costs no request
      gcTime: 15 * 60_000, // keep unused pages' data for 15 minutes so going back is instant
      refetchOnWindowFocus: true, // coming back to the app after a while still refreshes (only if stale)
      // a 4xx won't fix itself by asking again; network blips get one retry
      retry: (count, err) => !(err?.status >= 400 && err?.status < 500) && count < 1,
    },
  },
});
// setup data rarely changes and every save invalidates it, so it can stay fresh longer
for (const key of ['businesses', 'outlets', 'plans', 'groups', 'rooms', 'catalogue', 'staff-all', 'me']) {
  queryClient.setQueryDefaults([key], { staleTime: 5 * 60_000 });
}

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </QueryClientProvider>
);
