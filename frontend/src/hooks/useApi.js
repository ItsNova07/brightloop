import { useCallback, useEffect, useState } from "react";

// Runs an api.js function and tracks loading / error / data for you.
//
//   const { data, loading, error, reload } = useApi(() => getCustomers(), []);
//
// Pass the values the call depends on as the second argument
// (like useEffect), and it re-runs when they change.
export function useApi(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const load = useCallback(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    run()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => load(), [load]);

  const setData = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      data: typeof updater === "function" ? updater(prev.data) : updater,
    }));
  }, []);

  return { ...state, reload: load, setData };
}
