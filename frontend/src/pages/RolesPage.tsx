import { Button, Card, Group, Loader, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { IconListDetails, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { useRoleSummaries, type RoleStatus } from "../api/roleHooks";
import { RoleFormModal, RoleLine } from "../components/Roles";

const VIEWS: { value: RoleStatus | "all"; label: string }[] = [
  { value: "to_decide", label: "To decide" },
  { value: "applied", label: "Applied" },
  { value: "passed", label: "Passed" },
  { value: "all", label: "All" },
];

const EMPTY: Record<RoleStatus | "all", string> = {
  to_decide:
    "Nothing to decide. After a call with a recruiter, add the roles they mentioned here (or from the call on their page), then apply or pass on each.",
  applied: "No roles applied for from here yet.",
  passed: "You haven't passed on any roles.",
  all: "No roles yet.",
};

/** Roles before you apply: pitched by a recruiter or spotted, then applied for or passed on. */
export function RolesPage() {
  const [view, setView] = useState<RoleStatus | "all">("to_decide");
  const [adding, setAdding] = useState(false);
  const { data: roles, isLoading } = useRoleSummaries(view === "all" ? {} : { status: view });

  return (
    <Stack maw={1000}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Group gap="sm">
            <IconListDetails size={26} stroke={1.6} />
            <Title order={2}>Roles</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Roles you might go for, before you apply: decide whether to apply or pass on each.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          Add role
        </Button>
      </Group>
      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as RoleStatus | "all")}
        data={VIEWS}
        aria-label="Show"
        style={{ alignSelf: "flex-start" }}
      />
      {isLoading ? (
        <Loader />
      ) : !roles?.length ? (
        <Card withBorder p="xl">
          <Text c="dimmed" size="sm" ta="center">
            {EMPTY[view]}
          </Text>
        </Card>
      ) : (
        <Card withBorder>
          <Stack gap="sm">
            {roles.map((r) => (
              <RoleLine key={r.id} role={r} />
            ))}
          </Stack>
        </Card>
      )}
      {adding && <RoleFormModal opened onClose={() => setAdding(false)} />}
    </Stack>
  );
}
