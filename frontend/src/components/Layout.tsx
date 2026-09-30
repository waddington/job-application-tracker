import {
  ActionIcon,
  Anchor,
  AppShell,
  Burger,
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

import { NAV } from "../nav";
import { ApiStatus } from "./ApiStatus";
import { HeaderSearch } from "./HeaderSearch";

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const next = computed === "dark" ? "light" : "dark";
  return (
    <Tooltip label={`Switch to ${next} mode`}>
      <ActionIcon
        variant="subtle"
        size="lg"
        aria-label={`Switch to ${next} mode`}
        onClick={() => setColorScheme(next)}
      >
        {computed === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function Layout() {
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
              aria-label="Toggle navigation"
            />
            <IconTarget size={22} />
            <Title order={1} size="h4">
              Job Application Tracker
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <HeaderSearch />
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" aria-label="Main navigation">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            component={Link}
            to={item.path}
            label={item.label}
            leftSection={<item.icon size={18} stroke={1.6} />}
            active={item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)}
            onClick={close}
          />
        ))}
        <Stack gap={4} mt="auto" p="xs">
          <ApiStatus />
          <Text size="xs" c="dimmed">
            Local-first · your data stays on this machine
          </Text>
          <Tooltip label="Everything in one zip: your data, notes and files. Unzip it and run `jat restore`.">
            <Anchor href="/api/v1/backup/archive" download size="xs">
              <Group gap={4} wrap="nowrap">
                <IconDownload size={12} /> Download a backup
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
