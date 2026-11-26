import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

// One cache for the whole app. api() reads through it, so moving between tabs reuses what
// was loaded a moment ago instead of asking the server again, and two screens asking for
// the same thing at once share one request. Any save (POST/PUT/PATCH/DELETE) empties it,
// so the next screen always shows fresh numbers after a change.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      retry: (count, err) => !(err?.status >= 400 && err?.status < 500) && count < 1,
    },
  },
});

// how long a read stays fresh: setup data rarely changes (and every save clears the cache)
const LONG = /\/(plans|groups|rooms|catalogue|staff|outlets)(\?|$)|^\/(businesses|me)(\?|$)/;
// attendance stays short so the gym list (polled every 30s) keeps picking up QR check-ins
const SHORT = /\/attendance(\?|$)/;
export const freshFor = (path) => (LONG.test(path) ? 5 * 60_000 : SHORT.test(path) ? 15_000 : 60_000);

// coming back to the app after a while counts as a focus: stale queries refresh
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}
onlineManager.setOnline(true);

// for pull-to-refresh: forget everything so the next reads go to the server
export const refreshAll = () => queryClient.invalidateQueries();
