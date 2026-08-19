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
        // Some browsers (seen on older Android/Chromium builds) release the
        // lock for reasons other than a visibility change — battery saver
        // kicking in, an OS-level power event — without ever firing
        // visibilitychange. That release event is the one thing every
        // implementation fires regardless of cause, so re-acquire from it
        // directly instead of only trusting visibilitychange to catch it.
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
          if (!cancelled && document.visibilityState === "visible") acquire();
        });
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

    // Belt-and-braces heartbeat: on top of the release-event and
    // visibilitychange re-acquisition above, periodically check whether the
    // lock has silently gone missing (sentinelRef null while the page is
    // visible) and re-request it. Catches anything neither of those two
    // signals fired for — cheap, and the request itself is a no-op if a
    // lock is already held.
    const heartbeat = setInterval(() => {
      if (!sentinelRef.current && document.visibilityState === "visible") acquire();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [enabled]);
}

export default useWakeLock;
