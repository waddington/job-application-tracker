import { CloseButton, Group } from "@mantine/core";
import { useFocusTrap, useMediaQuery, useMergedRef } from "@mantine/hooks";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import theme from "../theme.module.css";
import classes from "./DockedPanel.module.css";

/**
 * Where a docked panel goes: Layout's dock beside the page (an AppShell aside), and how a panel tells Layout it's
 * open, so the page makes room for it (docs/rfc/app-redesign.md §2, Panels).
 */
export interface DockSlot {
  target: HTMLElement | null;
  setDocked: (docked: boolean) => void;
}

export const DockContext = createContext<DockSlot | null>(null);

/** Below 992 px (a phone or a small tablet) the panel is a full-screen overlay; from there it docks. */
export const OVERLAY_QUERY = "(max-width: 61.99em)";

/**
 * Marks what opens a panel, with the id of what it opens (`data-panel-opener={application.id}`): if the element
 * that opened the panel has gone by the time it closes (a board card moved to another column, a row filtered
 * away), focus goes back to the one that stands for the same thing now.
 */
export const OPENER_ATTR = "data-panel-opener";

interface PanelProps {
  opened: boolean;
  onClose: () => void;
  /** The panel's heading, which also names it (a labelled dialog). */
  title: string;
  /** The close button's label. */
  closeLabel: string;
  /** What the panel shows (an application's id): when it changes, focus moves to the heading again. */
  contentKey?: string | null;
  children: ReactNode;
}

/**
 * A side panel. From 992 px it docks beside the page: it slides in under the header with no overlay, and the page
 * shrinks to make room, still scrolling and taking clicks (another row swaps what the panel shows); a labelled,
 * non-modal dialog with no focus trap, so Tab carries on into the page. Narrower (and outside the app's Layout, as
 * when a test renders a page alone) it's a full-screen modal overlay.
 *
 * Either way, opening it moves focus to its heading, and closing it (its close button, or Escape) puts focus back
 * on what opened it. Its contents render in one element that moves between the dock and the overlay, so they keep
 * their state (a half-typed note) when the window crosses 992 px.
 */
export function DockedPanel({ opened, onClose, title, closeLabel, contentKey, children }: PanelProps) {
  const narrow = useMediaQuery(OVERLAY_QUERY, false, { getInitialValueInEffect: false });
  const slot = useContext(DockContext);
  const target = slot?.target ?? null;
  const setDocked = slot?.setDocked;
  const overlay = narrow || !slot;
  const shown = opened && (overlay || !!target);

  const titleId = useId();
  const [host] = useState(() => {
    const div = document.createElement("div");
    div.className = classes.host ?? "";
    return div;
  });
  const panel = useRef<HTMLDivElement>(null);
  const trap = useFocusTrap(shown && overlay);
  const panelRef = useMergedRef(panel, trap);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openerKey = useRef<string | null>(null);
  const wasOpen = useRef(false);
  const close = useEffectEvent(() => onClose());

  // The contents' one element goes in the dock or over the page, and away while closed. Moving it takes focus
  // out of it, so focus goes back to where it was.
  useLayoutEffect(() => {
    const parent = !shown ? null : overlay ? document.body : target;
    if (host.parentNode === parent) return;
    const active = document.activeElement;
    const hadFocus = active instanceof HTMLElement && host.contains(active);
    if (parent) parent.appendChild(host);
    else host.remove();
    if (hadFocus && parent) active.focus({ preventScroll: true });
  }, [host, shown, overlay, target]);
  useEffect(() => () => host.remove(), [host]);

  // Docked, the page makes room, and takes it back when the panel goes (or its page does).
  useEffect(() => setDocked?.(shown && !overlay), [shown, overlay, setDocked]);
  useEffect(() => () => setDocked?.(false), [setDocked]);

  // Over the page, the page behind doesn't scroll.
  useEffect(() => {
    if (!shown || !overlay) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [shown, overlay]);

  // Escape with focus nowhere closes it too: on the page's body (as after a button that had it was disabled while
  // it saved), or on something hidden (Move to…'s menu, closed after a move, can stay in the page faded to
  // nothing with focus on a part of itself, whose own handler would take the key first). An Escape from inside is handled on
  // the panel.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      const target = e.target;
      const nowhere =
        target === document.body ||
        target === document.documentElement ||
        (target instanceof Element && target.checkVisibility?.({ opacityProperty: true }) === false);
      if (nowhere) close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [shown]);

  // On opening, and on each swap to another item: remember what opened it, then focus the heading.
  useEffect(() => {
    if (!shown) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !panel.current?.contains(active)) {
      opener.current = active;
      openerKey.current = active.closest(`[${OPENER_ATTR}]`)?.getAttribute(OPENER_ATTR) ?? null;
    }
    heading.current?.focus({ preventScroll: true });
  }, [shown, contentKey]);

  // On closing, focus goes back to the opener (or what stands for it now, or the page's heading), unless it has
  // already moved somewhere else on the page.
  useEffect(() => {
    if (shown) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const back = opener.current;
    const key = openerKey.current;
    opener.current = null;
    openerKey.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const again =
      key && /^[\w-]+$/.test(key) ? document.querySelector<HTMLElement>(`[${OPENER_ATTR}="${key}"]`) : null;
    (back?.isConnected ? back : (again ?? pageHeading()))?.focus({ preventScroll: true });
  }, [shown]);

  return createPortal(
    shown ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={overlay}
        aria-labelledby={titleId}
        className={`${classes.panel} ${overlay ? classes.overlay : classes.docked}`}
        onKeyDown={(e) => {
          // Escape from inside the panel; one from a menu or dialog opened from it (rendered elsewhere in the
          // page, but bubbling through React) is theirs to handle.
          if (e.key !== "Escape" || e.nativeEvent.isComposing || e.defaultPrevented) return;
          if (!(e.target instanceof Node) || !panel.current?.contains(e.target)) return;
          e.stopPropagation();
          onClose();
        }}
      >
        <Group className={classes.header} justify="space-between" wrap="nowrap" gap="sm">
          <h2
            ref={heading}
            id={titleId}
            tabIndex={-1}
            data-autofocus
            className={`${theme.dialogTitle} ${classes.title}`}
          >
            {title}
          </h2>
          <CloseButton aria-label={closeLabel} onClick={onClose} />
        </Group>
        <div className={classes.body}>{children}</div>
      </div>
    ) : null,
    host,
  );
}

/** The page's own heading (or the page itself), for focus when what opened the panel has gone. */
function pageHeading(): HTMLElement | null {
  const main = document.querySelector("main");
  const found = main?.querySelector<HTMLElement>("h1, h2") ?? main;
  if (found && !found.hasAttribute("tabindex")) found.setAttribute("tabindex", "-1");
  return found ?? null;
}
