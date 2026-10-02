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

import { NAV, NAV_GROUPS } from "../nav";
import { ApiStatus } from "./ApiStatus";
import { HeaderSearch } from "./HeaderSearch";
import { HelpButton, NewApplicationButton } from "./HowItWorks";

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
            <Anchor
              component={Link}
              to="/"
              underline="never"
              c="inherit"
              aria-label="Job Application Tracker: overview"
            >
              <Group gap="xs" wrap="nowrap">
                <IconTarget size={22} />
                <Title order={1} size="h4" visibleFrom="xs">
                  Job Application Tracker
                </Title>
              </Group>
            </Anchor>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <NewApplicationButton />
            <HeaderSearch />
            <HelpButton />
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" aria-label="Main navigation">
        {NAV_GROUPS.map((group, n) => (
          <div key={group} role="group" aria-label={group}>
            {n > 0 && <Divider my={4} />}
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" pt={6} pb={2}>
              {group}
            </Text>
            {NAV.filter((item) => item.group === group).map((item) => (
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
          </div>
        ))}
        <Stack gap={4} mt="auto" p="xs">
          <ApiStatus />
          <Text size="xs" c="dimmed">
            Local-first · your data stays on this machine
          </Text>
          <Tooltip label="Everything in one zip: your data, notes and files. Unzip it and run `jat init` on the folder (it rebuilds everything).">
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
