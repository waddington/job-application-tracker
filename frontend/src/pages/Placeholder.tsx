import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";

import type { NavItem } from "../nav";

export function Placeholder({ item }: { item: NavItem }) {
  return (
    <Stack maw={720}>
      <Group gap="sm">
        <item.icon size={26} stroke={1.6} />
        <Title order={2}>{item.label}</Title>
      </Group>
      <Card withBorder padding="lg">
        <Text>{item.description}</Text>
        <Group mt="md" gap="xs">
          <Badge variant="light">Coming soon</Badge>
          <Text size="sm" c="dimmed">
            Roadmap task <code>{item.task}</code>
          </Text>
        </Group>
      </Card>
    </Stack>
  );
}
