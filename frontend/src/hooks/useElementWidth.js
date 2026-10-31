import { useLayoutEffect, useRef, useState } from "react";

// Tracks an element's width, so a chart can draw at real pixel size
// (crisp text and lines) and redraw when the window is resized.
//   const [ref, width] = useElementWidth();
//   <div ref={ref}>…</div>
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
