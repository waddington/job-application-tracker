/*
 * DEV ONLY (app-redesign-concepts, 9 to 11): the phone's bottom bar. Four tabs and More, which opens a sheet with
 * the other pages. concepts.ts mounts it in its own React root, outside the app's providers, so it uses plain
 * elements styled by concepts.css (only shown below 768 px) and finds pages through the router directly.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconDots } from "@tabler/icons-react";

import { isActive, NAV, type NavItem } from "../nav";
import { router } from "../router";

/** The pages with a tab of their own, in order. Everything else in the menu goes under More. */
export const PHONE_TABS = ["/", "/applications", "/interviews", "/notes"];

const tabs = PHONE_TABS.map((path) => NAV.find((item) => item.path === path)).filter(
  (item): item is NavItem => !!item,
);
const more = NAV.filter((item) => !PHONE_TABS.includes(item.path));

function usePathname() {
  const [pathname, setPathname] = useState(router.state.location.pathname);
  useEffect(() => router.subscribe("onResolved", ({ toLocation }) => setPathname(toLocation.pathname)), []);
  return pathname;
}

export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    router.history.push(path);
  };
  const button = (item: NavItem) => (
    <button
      key={item.path}
      type="button"
      aria-current={isActive(item, pathname) ? "page" : undefined}
      onClick={() => go(item.path)}
    >
      <item.icon size={22} stroke={1.6} aria-hidden />
      <span>{t(item.labelKey)}</span>
    </button>
  );
  const moreActive = more.some((item) => isActive(item, pathname));

  return (
    <>
      <nav className="bottom-nav" aria-label={t("nav.label")}>
        {tabs.map(button)}
        <button
          type="button"
          aria-expanded={open}
          aria-current={moreActive && !open ? "page" : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <IconDots size={22} stroke={1.6} aria-hidden />
          <span>{t("nav.more")}</span>
        </button>
      </nav>
      <div className="bottom-sheet-backdrop" data-open={open || undefined} onClick={() => setOpen(false)}>
        <div
          className="bottom-sheet"
          role="dialog"
          aria-label={t("nav.more")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bottom-sheet-grid">{more.map(button)}</div>
        </div>
      </div>
    </>
  );
}
