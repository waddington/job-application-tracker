import { Drawer, RemoveScroll, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconDots } from "@tabler/icons-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import { isActive, MORE_PAGES, PHONE_TABS, type NavItem } from "../nav";
import { useHealth } from "./ApiStatus";
import { useVersionMismatch } from "./AppVersion";
import classes from "./BottomNav.module.css";
import { MenuFooter } from "./MenuFooter";

const BELOW_HEADER = 64; // the header's 56 px and a little space

/**
 * The menu on a phone (docs/rfc/app-redesign.md §2, Phones): four pages, and More's sheet of the other seven and
 * the menu's footer. Layout renders it only below 768 px, so growing past that takes the sheet, its trap and its
 * scroll lock away. Dismissing the sheet gives focus back to More; a change of page leaves it on the page.
 */
export function BottomNav({ covered }: { covered: boolean }) {
  const { t } = useTranslation(["common", "applications"]);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion(false, { getInitialValueInEffect: false });
  const { isError } = useHealth();
  const mismatch = useVersionMismatch();
  const problem = isError ? t("api.offline") : mismatch;
  const problemId = useId();
  const bar = useRef<HTMLElement>(null);
  useKeysAboveBar(bar);
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
 * Keeps what the keyboard moves to clear of the bar, and only that: a scroll under a press moves what's pressed.
 * So the scroll padding is off from a press until the frame after its click (data-pressed), past the focus a click
 * sets (a label's, a Select's), or until a key. Tab also lifts: Firefox leaves some of what's partly in view.
 */
function useKeysAboveBar(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    const press = () => root.setAttribute("data-pressed", "");
    // Capture, so its frame runs before that of a click's own scroll (the calendar's, to the day's heading).
    const clicked = () => requestAnimationFrame(() => root.removeAttribute("data-pressed"));
    const key = (e: KeyboardEvent) => {
      root.removeAttribute("data-pressed");
      if (e.key !== "Tab") return;
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (!bar.current || !el?.closest("main")) return;
        const { top, bottom } = el.getBoundingClientRect();
        const under = bottom + 4 - bar.current.offsetTop; // 4: its focus ring; offsetTop: where it is, or returns to
        const by = Math.min(under, top - BELOW_HEADER); // something taller keeps its top in sight
        if (by > 0) window.scrollBy(0, by);
      });
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("click", clicked, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("click", clicked, true);
      root.removeAttribute("data-pressed");
    };
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
