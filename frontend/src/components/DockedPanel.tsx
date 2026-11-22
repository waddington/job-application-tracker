import { CloseButton, Group } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
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
  setCovered: (covered: boolean) => void; // over the screen, so the phone's bar behind it can't be reached
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
  const setCovered = slot?.setCovered;
  const overlay = narrow || !slot;
  const shown = opened && (overlay || !!target);

  const titleId = useId();
  const [host] = useState(() => {
    const div = document.createElement("div");
    div.className = classes.host ?? "";
    return div;
  });
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openerKey = useRef<string | null>(null);
  const wasOpen = useRef(false);
  /** Whether focus is in the panel, or in a menu or dialog opened from it (React's focus events reach the panel). */
  const ownsFocus = useRef(false);
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
  // Over it, Layout is told before focus goes back to what opened the panel.
  useLayoutEffect(() => {
    if (!shown || !overlay) return;
    setCovered?.(true);
    return () => setCovered?.(false);
  }, [shown, overlay, setCovered]);

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

  // Focus the panel had that's lost because what had it went away (Move to…'s menu, which unmounts after a move
  // with focus still in it) comes back to the heading, so Escape and the keyboard go on working there. Focus that
  // leaves for somewhere else, or for nowhere while what had it is still there (a click on the page), is let go.
  useEffect(() => {
    if (!shown) return;
    const onFocusOut = (e: FocusEvent) => {
      const left = e.target;
      if (e.relatedTarget !== null || !ownsFocus.current) {
        ownsFocus.current = false; // the panel's onFocus sets it again if focus moved within it
        return;
      }
      setTimeout(() => {
        const now = document.activeElement;
        if (now && now !== document.body) return;
        if (left instanceof Node && left.isConnected) ownsFocus.current = false;
        else heading.current?.focus({ preventScroll: true });
      });
    };
    // Firefox fires no focusout when the focused element is removed, so focus can sit on <body> with the panel
    // still owning it. The next Escape, Tab or arrow key then brings it back to the heading, and an Escape closes
    // the panel, unless another dialog is open over the page. A press anywhere else on the page lets go of it (focus
    // already on <body> stays there, so no focusout says so).
    const onPointerDown = (e: PointerEvent) => {
      const at = e.target instanceof Element ? e.target : null;
      if (at && (panel.current?.contains(at) || at.closest('[role="menu"], [role="dialog"]'))) return;
      ownsFocus.current = false;
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      // The key itself must have been pressed on <body>: a dialog that closes on this same Escape (the feedback
      // dialog) can drop focus to <body> before this runs, and that Escape was the dialog's.
      if (!ownsFocus.current || e.target !== document.body || document.activeElement !== document.body)
        return;
      if (e.ctrlKey || e.metaKey || e.altKey || !REFOCUS_KEYS.test(e.key)) return;
      const otherDialog = [...document.querySelectorAll('[aria-modal="true"]')].some(
        (d) => d !== panel.current,
      );
      if (otherDialog) return;
      heading.current?.focus({ preventScroll: true });
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return;
      e.preventDefault();
      close();
    };
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
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
        ref={panel}
        role="dialog"
        aria-modal={overlay}
        aria-labelledby={titleId}
        className={`${classes.panel} ${overlay ? classes.overlay : classes.docked}`}
        onFocus={() => {
          ownsFocus.current = true;
        }}
        onKeyDown={(e) => {
          // Over the page, Tab goes round the panel's controls (it never moves focus by itself, so crossing
          // 992 px leaves it where it was).
          if (overlay && e.key === "Tab" && panel.current) {
            trapTab(panel.current, e);
            return;
          }
          // Escape from inside the panel; one from a menu or dialog opened from it (rendered elsewhere in the
          // page, but bubbling through React) is theirs to handle.
          if (e.key !== "Escape" || e.nativeEvent.isComposing || e.defaultPrevented) return;
          if (!(e.target instanceof Node) || !panel.current?.contains(e.target)) return;
          e.stopPropagation();
          onClose();
        }}
      >
        <Group className={classes.header} justify="space-between" wrap="nowrap" gap="sm">
          <h2 ref={heading} id={titleId} tabIndex={-1} className={`${theme.dialogTitle} ${classes.title}`}>
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

/**
 * The page's own heading (or the page itself), for focus when what opened the panel has gone. It's made
 * focusable only until focus leaves it, so the page's markup is left as it was.
 */
function pageHeading(): HTMLElement | null {
  const main = document.querySelector("main");
  const found = main?.querySelector<HTMLElement>("h1, h2") ?? main;
  if (found && !found.hasAttribute("tabindex")) {
    found.setAttribute("tabindex", "-1");
    found.addEventListener("blur", () => found.removeAttribute("tabindex"), { once: true });
  }
  return found ?? null;
}

const TABBABLE = "a[href], button, input, select, textarea, [tabindex]";
/** The keys that bring lost focus back to the panel: the ones that move around it or close it. */
const REFOCUS_KEYS = /^(Escape|Tab|Arrow(Up|Down|Left|Right))$/;

/** Keeps Tab and Shift+Tab going round the panel's own controls (the overlay's focus trap). */
function trapTab(node: HTMLElement, e: KeyboardEvent) {
  if (!(e.target instanceof Node) || !node.contains(e.target)) return; // a menu opened from it moves its own way
  const items = [...node.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) {
    e.preventDefault();
    return;
  }
  const active = document.activeElement as HTMLElement | null;
  const at = active ? items.indexOf(active) : -1;
  if (e.shiftKey && at <= 0) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === -1 || active === last)) {
    e.preventDefault();
    first.focus();
  }
}
