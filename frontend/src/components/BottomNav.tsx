import { Drawer, RemoveScroll, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { useMediaQuery, useReducedMotion } from "@mantine/hooks";
import { IconDots } from "@tabler/icons-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { isActive, MORE_PAGES, PHONE_TABS, type NavItem } from "../nav";
import { useHealth } from "./ApiStatus";
import { useVersionMismatch } from "./AppVersion";
import classes from "./BottomNav.module.css";
import { MenuFooter } from "./MenuFooter";

/** A window too short to spare the bar's height: a phone on its side, or with the keyboard up. */
const SHORT_QUERY = "(max-height: 500px)";
/** The header's 56 px and a little space. */
const BELOW_HEADER = 64;
/** What you type in. */
const FIELD =
  'textarea, [contenteditable="true"], input:not([type="button"], [type="checkbox"], [type="file"], [type="radio"], [type="range"], [type="reset"], [type="submit"])';

/**
 * The menu on a phone (docs/rfc/app-redesign.md §2, Phones): a bar of four pages and More, whose sheet has the
 * other seven and the menu's footer. Layout renders it only below 768 px, so growing past that takes the sheet,
 * its focus trap and its scroll lock away with it. `covered`: a full-screen quick view is over the page.
 *
 * Dismissing the sheet gives focus back to More. Going to a page from it, or any change of address while it's
 * open (Back), closes it and leaves focus on the page instead.
 */
export function BottomNav({ covered }: { covered: boolean }) {
  // The quick view's Close: the same word, for the sheet's close button.
  const { t } = useTranslation(["common", "applications"]);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion(false, { getInitialValueInEffect: false });
  const away = useTypingInShortWindow();
  const { isError } = useHealth();
  const mismatch = useVersionMismatch();
  const problem = isError ? t("api.offline") : mismatch;
  const problemId = useId();
  const bar = useRef<HTMLElement>(null);
  useFocusAboveBar(bar);
  const more = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);

  const dismiss = () => {
    setOpened(false);
    // Ourselves, not Drawer's returnFocus: Safari doesn't focus a button you click, so it wouldn't know of More.
    more.current?.focus({ preventScroll: true });
  };
  const leave = () => {
    setOpened(false);
    focusPage();
  };
  useEffect(() => {
    if (!opened) return;
    return router.history.subscribe(() => {
      setOpened(false);
      focusPage();
    });
  }, [opened, router]);

  const link = (item: NavItem, onClick?: () => void) => (
    <Link
      key={item.path}
      to={item.path}
      className={classes.item}
      // Said here too: the router only knows an item's own path, not the sections under it (/people).
      aria-current={isActive(item, pathname) ? "page" : undefined}
      onClick={onClick}
    >
      <span className={classes.icon}>
        <item.icon size={22} stroke={1.6} aria-hidden />
      </span>
      <span className={classes.label}>{t(item.labelKey)}</span>
    </Link>
  );

  return (
    <>
      <nav
        ref={bar}
        aria-label={t("nav.label")}
        // fullWidth: it keeps its width when a dialog takes the scrollbar away.
        className={`${classes.bar} ${RemoveScroll.classNames.fullWidth}`}
        data-away={away || undefined}
        inert={covered}
      >
        {PHONE_TABS.map((item) => link(item))}
        <UnstyledButton
          ref={more}
          className={classes.item}
          aria-haspopup="dialog"
          aria-expanded={opened}
          aria-current={MORE_PAGES.some((item) => isActive(item, pathname)) || undefined}
          aria-describedby={problem ? problemId : undefined}
          onClick={() => setOpened(true)}
        >
          <span className={classes.icon}>
            <IconDots size={22} stroke={1.6} aria-hidden />
            {problem && <span className={classes.alert} aria-hidden data-testid="more-alert" />}
          </span>
          <span className={classes.label}>{t("nav.more")}</span>
        </UnstyledButton>
      </nav>
      {/* The footer that says what's wrong is in the closed sheet, so it's also said here. */}
      <VisuallyHidden id={problemId} role="status">
        {problem}
      </VisuallyHidden>

      <Drawer
        opened={opened}
        onClose={dismiss}
        returnFocus={false}
        position="bottom"
        title={t("nav.more")}
        closeButtonProps={{ "aria-label": t("applications:summary.closeDrawer") }}
        transitionProps={{ duration: reduceMotion ? 0 : 250 }}
        classNames={{ content: classes.sheet }}
      >
        <nav aria-label={t("nav.label")} className={classes.grid}>
          {MORE_PAGES.map((item) => link(item, leave))}
        </nav>
        <MenuFooter className={classes.footer} />
      </Drawer>
    </>
  );
}

/**
 * Lifts what gets focus on the page clear of the bar. The scroll padding does it where the browser scrolls for
 * focus, but Firefox doesn't scroll to what's partly in view already, as a row half under the bar is.
 */
function useFocusAboveBar(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const lift = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement || el instanceof SVGElement) || !el.closest("main")) return;
      requestAnimationFrame(() => {
        if (!bar.current || !el.matches(":focus-visible")) return;
        const { top, bottom } = el.getBoundingClientRect();
        const under = bottom + 4 - bar.current.getBoundingClientRect().top; // 4: its focus ring
        const by = Math.min(under, top - BELOW_HEADER); // something taller keeps its top in sight
        if (by > 0) window.scrollBy(0, by);
      });
    };
    document.addEventListener("focusin", lift);
    return () => document.removeEventListener("focusin", lift);
  }, [bar]);
}

/** Puts focus on the page, focusable only until focus leaves it (so clicking the page doesn't focus it). */
function focusPage() {
  const main = document.querySelector("main");
  if (!main) return;
  main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
  main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
}

/**
 * Whether you're typing in a short window, where the bar would float over the box. It's read once a press has
 * ended: the bar coming back as a press on a button took focus out of the box would land under that press.
 */
function useTypingInShortWindow(): boolean {
  const short = useMediaQuery(SHORT_QUERY, false, { getInitialValueInEffect: false });
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!short) return;
    let pressed = false;
    let timer: number | undefined;
    const look = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!pressed) setTyping(!!document.activeElement?.matches(FIELD));
      });
    };
    const press = () => {
      pressed = true;
    };
    const release = () => {
      pressed = false;
      look();
    };
    look();
    const events = [
      ["focusin", look],
      ["focusout", look],
      ["pointerdown", press],
      ["pointerup", release],
      ["pointercancel", release],
    ] as const;
    for (const [type, listener] of events) document.addEventListener(type, listener, true);
    return () => {
      window.clearTimeout(timer);
      for (const [type, listener] of events) document.removeEventListener(type, listener, true);
    };
  }, [short]);
  return short && typing;
}
