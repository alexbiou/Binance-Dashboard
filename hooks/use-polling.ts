"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, isAbortError } from "@/lib/binance/rest";

interface PollState<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

/**
 * Poll a fetcher at a fixed interval. Pauses while the tab is hidden, aborts on unmount
 * or when `key` changes, and never overlaps requests (the next one is scheduled after the last settles).
 */
export function usePolling<T>(fetcher: (signal: AbortSignal) => Promise<T>, intervalMs: number, key: string): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ loading: true });
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;

    setState({ loading: true });

    const schedule = () => {
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    async function tick() {
      if (document.hidden) {
        schedule();
        return;
      }
      ctrl = new AbortController();
      try {
        const data = await fetcherRef.current(ctrl.signal);
        if (!cancelled) setState({ data, loading: false });
      } catch (e) {
        if (cancelled || isAbortError(e)) return;
        setState((s) => ({ data: s.data, error: errorMessage(e), loading: false }));
      }
      schedule();
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      ctrl?.abort();
    };
  }, [key, intervalMs]);

  return state;
}
