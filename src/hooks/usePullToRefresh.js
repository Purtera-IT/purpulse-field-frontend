/**
 * usePullToRefresh — native-feel pull-to-refresh for scrollable containers.
 * Attach containerRef to the scrollable element.
 * onRefresh should return a Promise.
 */
import { useRef, useState, useCallback } from 'react';

const THRESHOLD = 72; // px to pull before triggering
const RESISTANCE = 2.5;

export function usePullToRefresh(onRefresh) {
  const containerRef = useRef(null);
  const startYRef    = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing,   setRefreshing]   = useState(false);

  const onTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startYRef.current === null || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) { startYRef.current = null; return; }
    const delta = (e.touches[0].clientY - startYRef.current) / RESISTANCE;
    if (delta > 0) {
      e.preventDefault();
      setPullDistance(Math.min(delta, THRESHOLD * 1.5));
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(0);
      try { await onRefresh(); } finally { setRefreshing(false); }
    } else {
      setPullDistance(0);
    }
    startYRef.current = null;
  }, [pullDistance, onRefresh]);

  return { containerRef, pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}