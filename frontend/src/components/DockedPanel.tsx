import { CloseButton, Drawer, Group } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";
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

/** A phone (below 768 px) keeps the panel as a full-screen overlay. */
export const PHONE_QUERY = "(max-width: 47.99em)";

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
 * A side panel docked beside the page on a tablet or desktop: it slides in under the header with no overlay, and
 * the page shrinks to make room, still scrolling and taking clicks (another row swaps what the panel shows). It's
 * a labelled, non-modal dialog: opening it moves focus to its heading, closing it (its close button, or Escape
 * from inside) puts focus back on what opened it. There's no focus trap, so Tab carries on into the page.
 *
 * On a phone, or outside the app's Layout (a test rendering a page alone), it's a full-screen Drawer instead.
 */
export function DockedPanel(props: PanelProps) {
  const phone = useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false });
  const slot = useContext(DockContext);
  if (phone || !slot) {
    return (
      <Drawer
        opened={props.opened}
        onClose={props.onClose}
        position="right"
        size={phone ? "100%" : "lg"}
        title={props.title}
        closeButtonProps={{ "aria-label": props.closeLabel }}
      >
        {props.children}
      </Drawer>
    );
  }
  return <Docked {...props} slot={slot} />;
}

function Docked({
  opened,
  onClose,
  title,
  closeLabel,
  contentKey,
  children,
  slot,
}: PanelProps & { slot: DockSlot }) {
  const { target, setDocked } = slot;
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const shown = opened && !!target;

  // The page makes room while the panel shows, and takes it back when the panel goes (or its page does).
  useEffect(() => setDocked(shown), [shown, setDocked]);
  useEffect(() => () => setDocked(false), [setDocked]);

  // On opening, and on each swap to another item: remember what opened it, then focus the heading.
  useEffect(() => {
    if (!shown) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !panel.current?.contains(active)) {
      opener.current = active;
    }
    heading.current?.focus({ preventScroll: true });
  }, [shown, contentKey]);

  // On closing, focus goes back to the opener, unless it has already moved somewhere else on the page.
  useEffect(() => {
    if (shown) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const back = opener.current;
    opener.current = null;
    const active = document.activeElement;
    if (back?.isConnected && (!active || active === document.body)) back.focus({ preventScroll: true });
  }, [shown]);

  if (!shown) return null;
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={classes.panel}
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
        <h2 ref={heading} id={titleId} tabIndex={-1} className={`${theme.dialogTitle} ${classes.title}`}>
          {title}
        </h2>
        <CloseButton aria-label={closeLabel} onClick={onClose} />
      </Group>
      <div className={classes.body}>{children}</div>
    </div>,
    target,
  );
}
