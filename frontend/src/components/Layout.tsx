import {
  ActionIcon,
  Anchor,
  AppShell,
  Burger,
  Divider,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconDownload, IconMoon, IconSun, IconTarget } from "@tabler/icons-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";

import { useTranslation } from "react-i18next";

import { NAV, NAV_GROUP_KEYS, NAV_GROUPS } from "../nav";
import { ApiStatus } from "./ApiStatus";
import { HeaderSearch } from "./HeaderSearch";
import { HelpButton, LanguageSwitch, NewApplicationButton } from "./HeaderButtons";

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

export function Layout() {
  const { t } = useTranslation();
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 230, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={t("header.toggleNav")}
            />
            <Anchor component={Link} to="/" underline="never" c="inherit" aria-label={t("app.homeLabel")}>
              <Group gap="xs" wrap="nowrap">
                <IconTarget size={22} />
                <Title order={1} size="h4" visibleFrom="xs">
                  {t("app.name")}
                </Title>
              </Group>
            </Anchor>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <NewApplicationButton compact />
            <HeaderSearch />
            <HelpButton />
            <LanguageSwitch />
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" aria-label={t("nav.label")}>
        {NAV_GROUPS.map((group, n) => {
          const items = NAV.filter((item) => item.group === group);
          // A heading that only repeats its one item's name ("Today") says nothing.
          const heading = !(items.length === 1 && t(items[0]!.labelKey) === t(NAV_GROUP_KEYS[group]));
          return (
            <div key={group} role="group" aria-label={t(NAV_GROUP_KEYS[group])}>
              {n > 0 && <Divider my={4} />}
              {heading && (
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" pt={6} pb={2}>
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
                  active={item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)}
                  onClick={close}
                />
              ))}
            </div>
          );
        })}
        <Stack gap={4} mt="auto" p="xs">
          <ApiStatus />
          <Text size="xs" c="dimmed">
            {t("footer.localFirst")}
          </Text>
          <Tooltip label={t("footer.backupHint")}>
            <Anchor href="/api/v1/backup/archive" download size="xs">
              <Group gap={4} wrap="nowrap">
                <IconDownload size={12} /> {t("footer.backup")}
              </Group>
            </Anchor>
          </Tooltip>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
