import {
  ActionIcon,
  Anchor,
  AppShell,
  Group,
  NavLink,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconMoon, IconSun, IconTarget } from "@tabler/icons-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { isActive, NAV, NAV_GROUP_KEYS, NAV_GROUPS } from "../nav";
import theme from "../theme.module.css";
import { usePhone } from "../utils/usePhone";
import classes from "./Layout.module.css";
import { BottomNav } from "./BottomNav";
import { DockContext } from "./DockedPanel";
import { HeaderSearch } from "./HeaderSearch";
import { HelpButton, LanguageSwitch, NewApplicationButton } from "./HeaderButtons";
import { MenuFooter } from "./MenuFooter";

function ColorSchemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const next = computed === "dark" ? "light" : "dark";
  const label = next === "dark" ? t("theme.toDark") : t("theme.toLight");
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" size="lg" aria-label={label} onClick={() => setColorScheme(next)}>
        {computed === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

// The dock's width with its margin, from 992 px (md, DockedPanel's OVERLAY_QUERY): narrower until 1,200 px, so the
// page keeps some room. Below 992 px the panel covers the screen instead.
const DOCK_WIDTH = { base: 440, lg: 540 };

export function Layout() {
  const { t } = useTranslation();
  const phone = usePhone();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The dock beside the page, where a page's side panel (DockedPanel) goes; while one shows, the page makes room.
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [covered, setCovered] = useState(false); // a panel over the whole screen instead
  const slot = useMemo(() => ({ target: dock, setDocked, setCovered }), [dock]);
  const reduceMotion = useReducedMotion();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 230, breakpoint: "sm", collapsed: { mobile: true } }}
      aside={{ width: DOCK_WIDTH, breakpoint: "md", collapsed: { mobile: true, desktop: !docked } }}
      padding={{ base: "md", sm: 28 }}
      transitionDuration={reduceMotion ? 0 : 350}
      transitionTimingFunction="cubic-bezier(0.22, 0.61, 0.24, 1)"
      classNames={{ header: classes.header, navbar: classes.navbar, main: classes.main, aside: classes.dock }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" className={classes.headerRow}>
          <Group gap="xs">
            <Anchor component={Link} to="/" underline="never" c="inherit" aria-label={t("app.homeLabel")}>
              <Group gap="xs" wrap="nowrap">
                <IconTarget size={22} />
                <Title order={1} size="h4" visibleFrom="xs" className={classes.brand}>
                  {t("app.name")}
                </Title>
              </Group>
            </Anchor>
          </Group>
          <Group gap="sm" wrap="nowrap" className={classes.headerActions}>
            <NewApplicationButton compact />
            <HeaderSearch />
            <HelpButton />
            <LanguageSwitch />
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      {/* Not shown on a phone: the bottom bar takes its place, and the footer goes in its sheet (one at a time). */}
      <AppShell.Navbar p="xs" aria-label={t("nav.label")} visibleFrom="sm">
        {NAV_GROUPS.map((group, n) => {
          const items = NAV.filter((item) => item.group === group);
          // A heading that only repeats its one item's name ("Today") says nothing.
          const heading = !(items.length === 1 && t(items[0]!.labelKey) === t(NAV_GROUP_KEYS[group]));
          return (
            <div
              key={group}
              role="group"
              aria-label={t(NAV_GROUP_KEYS[group])}
              className={n > 0 ? classes.group : undefined}
            >
              {heading && (
                <Text className={theme.eyebrow} px="sm" pt={6} pb={2}>
                  {t(NAV_GROUP_KEYS[group])}
                </Text>
              )}
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  component={Link}
                  to={item.path}
                  label={t(item.labelKey)}
                  leftSection={<item.icon size={18} stroke={1.6} />}
                  className={classes.navLink}
                  active={isActive(item, pathname)}
                />
              ))}
            </div>
          );
        })}
        {!phone && <MenuFooter mt="auto" p="xs" />}
      </AppShell.Navbar>

      <DockContext.Provider value={slot}>
        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </DockContext.Provider>
      {/* After the page, so Tab goes from the page into the panel and on, with no trap. */}
      <AppShell.Aside ref={setDock} />
      {phone && <BottomNav covered={covered} />}
    </AppShell>
  );
}
