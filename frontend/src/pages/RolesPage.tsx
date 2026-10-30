import { Button, Card, Group, Loader, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { IconListDetails, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useRoleSummaries, type RoleStatus } from "../api/roleHooks";
import { RoleFormModal, RoleLine } from "../components/Roles";

type View = RoleStatus | "all";

const VIEWS: { value: View; label: `views.${View}` }[] = [
  { value: "to_decide", label: "views.to_decide" },
  { value: "interested", label: "views.interested" },
  { value: "applied", label: "views.applied" },
  { value: "closed", label: "views.closed" },
  { value: "passed", label: "views.passed" },
  { value: "all", label: "views.all" },
];

const EMPTY: Record<View, `empty.${View}`> = {
  to_decide: "empty.to_decide",
  interested: "empty.interested",
  applied: "empty.applied",
  closed: "empty.closed",
  passed: "empty.passed",
  all: "empty.all",
};

/** Roles before you apply: pitched by a recruiter or spotted, then applied for or passed on. */
export function RolesPage() {
  const { t } = useTranslation("roles");
  const [view, setView] = useState<View>("to_decide");
  const [adding, setAdding] = useState(false);
  const { data: roles, isLoading } = useRoleSummaries(view === "all" ? {} : { status: view });

  return (
    <Stack maw={1000}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Group gap="sm">
            <IconListDetails size={26} stroke={1.6} />
            <Title order={2}>{t("title")}</Title>
          </Group>
          <Text c="dimmed" size="sm">
            {t("intro")}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          {t("add")}
        </Button>
      </Group>
      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as View)}
        data={VIEWS.map((v) => ({ value: v.value, label: t(v.label) }))}
        aria-label={t("views.label")}
        style={{ alignSelf: "flex-start" }}
      />
      {isLoading ? (
        <Loader />
      ) : !roles?.length ? (
        <Card withBorder p="xl">
          <Text c="dimmed" size="sm" ta="center">
            {t(EMPTY[view])}
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
