import { useState, useRef } from "react";

/**
 * Drag-to-dismiss for bottom sheets.
 * Attach handleProps to a non-scrolling zone at the top of a sheet.
 * Follows finger in real time; past threshold on release it closes.
 */
export function useSwipeToClose(onClose, threshold = 100) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);
  const draggingRef = useRef(false);

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    draggingRef.current = true;
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  };

  const onTouchEnd = () => {
    draggingRef.current = false;
    if (dragY > threshold) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0);
    }
  };

  return {
    dragY,
    handleProps: { onTouchStart, onTouchMove, onTouchEnd },
    sheetStyle: {
      transform: `translateY(${dragY}px)`,
      transition: draggingRef.current ? "none" : "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
    },
  };
}

export default useSwipeToClose;
