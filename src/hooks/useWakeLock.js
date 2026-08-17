import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake for as long as the calling component is mounted —
 * for the staff displays (OrderManager, KitchenDisplay, TvKitchenDisplay)
 * that are meant to stay lit and visible on a mounted screen/tablet all
 * service, not dim or sleep like a device nobody's actively touching.
 *
 * The Wake Lock API releases itself automatically whenever the tab/window
 * loses visibility (backgrounded, screen locked, OS switches away) — this
 * re-acquires on the next `visibilitychange` back to visible, so a kitchen
 * tablet that briefly went to another app and came back doesn't stay
 * unlocked for the rest of the shift.
 *
 * No-ops safely wherever the API doesn't exist (older Safari, a non-secure
 * context, etc.) rather than throwing — falling back to whatever the
 * device's own screen-timeout setting is, same as before this existed.
 */
export function useWakeLock(enabled = true) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          // Component unmounted (or effect re-ran) while the request was
          // in flight — release immediately rather than leak a lock this
          // hook no longer owns.
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Request can legitimately fail (tab not visible yet, battery
        // saver, etc.) — the visibilitychange listener below retries once
        // the tab is actually visible again.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [enabled]);
}

export default useWakeLock;
