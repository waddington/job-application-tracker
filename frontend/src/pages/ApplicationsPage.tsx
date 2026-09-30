import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  MultiSelect,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue, useLocalStorage } from "@mantine/hooks";
import { IconBriefcase, IconChevronDown, IconChevronUp, IconPlus, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import type { ApplicationRow } from "../api/client";
import {
  stageLookup,
  useAgencies,
  useApplications,
  useWorkflow,
  type ApplicationFilters,
} from "../api/hooks";
import { ApplicationDrawer } from "../components/ApplicationDrawer";
import { Board } from "../components/Board";
import { NewApplicationModal } from "../components/NewApplicationModal";
import { StageBadge } from "../components/StageBadge";
import { ago } from "../utils/time";

type Sort = NonNullable<ApplicationFilters["sort"]>;

function SortHeader({
  label,
  asc,
  desc,
  sort,
  onSort,
}: {
  label: string;
  asc: Sort;
  desc?: Sort;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const active = sort === asc || sort === desc;
  const next = sort === asc && desc ? desc : asc;
  return (
    <UnstyledButton onClick={() => onSort(next)} fw={600} fz="sm">
      <Group gap={4} wrap="nowrap">
        {label}
        {active && (sort === desc ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />)}
      </Group>
    </UnstyledButton>
  );
}

function routeLabel(row: ApplicationRow): string {
  if (row.route === "agency")
    return [row.recruiter_name, row.agency_name].filter(Boolean).join(" · ") || "Agency";
  return row.route === "referral" ? "Referral" : "Direct";
}

export function ApplicationsPage() {
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q, 250);
  const [stage, setStage] = useState<string[]>([]);
  const [route, setRoute] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [staleOnly, setStaleOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState<Sort>("-last_activity");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useLocalStorage<"list" | "board">({
    key: "jat.applications.view",
    defaultValue: "list",
    getInitialValueInEffect: false, // no flash of the list when the board was chosen
  });
  // ?view=board or ?view=list in the address opens that view (and remembers it).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested !== "board" && requested !== "list") return;
    setView(requested);
    // Apply once, then drop it from the address so it doesn't override later choices.
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, [setView]);

  const { data: workflow } = useWorkflow();
  const { data: agencies } = useAgencies();
  const stages = stageLookup(workflow);
  const filters: ApplicationFilters = {
    q: debouncedQ || undefined,
    stage,
    route: (route as ApplicationFilters["route"]) ?? undefined,
    agency_id: agencyId ?? undefined,
    stale: staleOnly || undefined,
    archived,
    sort,
  };
  const { data: rows, isLoading, isFetching } = useApplications(filters);
  const filtered = !!(debouncedQ || stage.length || route || agencyId || staleOnly || archived);

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="sm">
          <IconBriefcase size={26} stroke={1.6} />
          <Title order={2}>Applications</Title>
          {rows && (
            <Badge variant="light" color="gray">
              {rows.length}
            </Badge>
          )}
          {isFetching && !isLoading && <Loader size="xs" />}
        </Group>
        <Group gap="sm">
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as "list" | "board")}
            data={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
            aria-label="View"
          />
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New application
          </Button>
        </Group>
      </Group>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          placeholder="Search company, role, recruiter…"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={300}
          aria-label="Search"
        />
        <MultiSelect
          placeholder={stage.length ? undefined : "All stages"}
          data={(workflow?.stages ?? []).map((s) => ({ value: s.id, label: s.name }))}
          value={stage}
          onChange={setStage}
          clearable
          w={240}
          aria-label="Stages"
        />
        <Select
          placeholder="Any route"
          data={[
            { value: "direct", label: "Direct" },
            { value: "agency", label: "Recruiter" },
            { value: "referral", label: "Referral" },
          ]}
          value={route}
          onChange={setRoute}
          clearable
          w={140}
          aria-label="Route"
        />
        <Select
          placeholder="Any agency"
          data={(agencies ?? []).map((a) => ({ value: a.id, label: a.name }))}
          value={agencyId}
          onChange={setAgencyId}
          clearable
          searchable
          w={200}
          aria-label="Agency"
        />
        <Switch
          label="Needs chasing"
          checked={staleOnly}
          onChange={(e) => setStaleOnly(e.currentTarget.checked)}
        />
        <Switch label="Archived" checked={archived} onChange={(e) => setArchived(e.currentTarget.checked)} />
      </Group>

      {isLoading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : !rows?.length ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="xs">
            <Text fw={600}>{filtered ? "No applications match these filters" : "No applications yet"}</Text>
            <Text c="dimmed" size="sm">
              {filtered ? "Try clearing a filter." : "Add the first one: company, role and how you applied."}
            </Text>
            {!filtered && (
              <Button mt="sm" leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
                New application
              </Button>
            )}
          </Stack>
        </Card>
      ) : view === "board" && workflow ? (
        <Board workflow={workflow} rows={rows} onOpen={setOpenId} />
      ) : (
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" miw={760}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <SortHeader label="Company / role" asc="company" sort={sort} onSort={setSort} />
                </Table.Th>
                <Table.Th>Route</Table.Th>
                <Table.Th>
                  <SortHeader label="Stage" asc="stage" sort={sort} onSort={setSort} />
                </Table.Th>
                <Table.Th>
                  <SortHeader
                    label="Last activity"
                    asc="last_activity"
                    desc="-last_activity"
                    sort={sort}
                    onSort={setSort}
                  />
                </Table.Th>
                <Table.Th>Tags</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(row.id);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open ${row.role_title} at ${row.company_name}`}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {row.company_name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {row.role_title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{routeLabel(row)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <StageBadge stage={stages.get(row.stage)} fallback={row.stage_name} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={row.stale ? "red" : undefined} fw={row.stale ? 600 : undefined}>
                      {ago(row.days_since_activity)}
                    </Text>
                    {row.stale && (
                      <Text size="xs" c="red">
                        needs chasing
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {row.tags.map((t) => (
                        <Badge key={t} size="sm" variant="dot" color="gray">
                          {t}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <NewApplicationModal
        opened={creating}
        onClose={(id) => {
          setCreating(false);
          if (id) setOpenId(id);
        }}
      />
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
