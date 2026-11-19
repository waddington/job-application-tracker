import {
  ScrollArea,
  SegmentedControl,
  type ScrollAreaProps,
  type SegmentedControlProps,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import classes from "./SideScroll.module.css";

/**
 * Something that may be wider than its space (a table, a row of views) scrolling sideways inside it, so the page
 * never does. An edge fades while there's more past it.
 */
export function SideScroll({
  children,
  ...props
}: Omit<ScrollAreaProps, "scrollbars" | "viewportRef" | "onScrollPositionChange"> & { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const e = viewport.current;
    if (!e) return;
    const start = e.scrollLeft > 1;
    const end = e.scrollLeft < e.scrollWidth - e.clientWidth - 1;
    setMore((m) => (m.start === start && m.end === end ? m : { start, end }));
  }, []);
  useEffect(() => {
    const e = viewport.current;
    if (!e) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // The space or what's in it can change size (a window resize, rows loading, a language switch). Mantine's content
    // box is as wide as the space, so watch what's inside it: that's what grows past it. Only the children there when
    // it mounts are watched, so a SideScroll's child should stay mounted (each use today does).
    const observer = new ResizeObserver(measure);
    observer.observe(e);
    for (const child of e.firstElementChild?.children ?? []) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);
  return (
    <ScrollArea
      {...props}
      scrollbars="x"
      viewportRef={viewport}
      onScrollPositionChange={measure}
      classNames={{ root: classes.root, viewport: classes.viewport }}
      mod={{ "more-start": more.start, "more-end": more.end }}
    >
      {children}
    </ScrollArea>
  );
}

/**
 * A row of views (a SegmentedControl) that scrolls sideways in its own space when it doesn't fit (a phone, a longer
 * language), bringing the picked one fully into view however it was picked: a tap, a click or the arrow keys.
 */
export function ScrollingViews(props: SegmentedControlProps) {
  const row = useRef<HTMLDivElement>(null);
  const shown = useRef(props.value);
  useEffect(() => {
    // Only when the pick changes, so opening the page never scrolls it.
    if (shown.current === props.value) return;
    shown.current = props.value;
    row.current
      ?.querySelector("input:checked")
      ?.closest("[class*=SegmentedControl-control]")
      ?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  }, [props.value]);
  return (
    <SideScroll maw="100%" offsetScrollbars="x">
      <div ref={row} className={classes.views}>
        <SegmentedControl {...props} />
      </div>
    </SideScroll>
  );
}
