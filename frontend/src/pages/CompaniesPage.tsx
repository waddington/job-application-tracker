import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconBuilding, IconPlus, IconSearch } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useCreateCompany } from "../api/detailHooks";
import { useApplications, useCompanies } from "../api/hooks";

function NewCompanyModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const create = useCreateCompany();
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { name: "", website: "" },
    validate: {
      name: (v) => (v.trim() ? null : "Name the company"),
      website: (v) => (!v || /^https?:\/\//.test(v) ? null : "Links start with http:// or https://"),
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="New company">
      <form
        onSubmit={form.onSubmit((values) =>
          create.mutate(
            { name: values.name.trim(), website: values.website || null, description: null },
            {
              onSuccess: (company) => {
                form.reset();
                onClose();
                void navigate({ to: `/companies/${company.id}` });
              },
            },
          ),
        )}
      >
        <Stack>
          <TextInput label="Name" data-autofocus {...form.getInputProps("name")} />
          <TextInput label="Website" placeholder="https://…" {...form.getInputProps("website")} />
          <Group justify="flex-end">
            <Button type="submit" loading={create.isPending}>
              Add company
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function CompaniesPage() {
  const { data: companies, isLoading } = useCompanies();
  const { data: apps } = useApplications({});
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const stats = new Map<string, { total: number; active: number; stale: number }>();
  for (const a of apps ?? []) {
    const s = stats.get(a.company_id) ?? { total: 0, active: 0, stale: 0 };
    s.total += 1;
    if (a.stage_kind === "active") s.active += 1;
    if (a.stale) s.stale += 1;
    stats.set(a.company_id, s);
  }
  const shown = (companies ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="sm">
          <IconBuilding size={26} stroke={1.6} />
          <Title order={2}>Companies</Title>
          {companies && (
            <Badge variant="light" color="gray">
              {companies.length}
            </Badge>
          )}
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          New company
        </Button>
      </Group>
      <TextInput
        placeholder="Search companies"
        leftSection={<IconSearch size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        w={300}
        aria-label="Search companies"
      />
      {isLoading ? (
        <Loader />
      ) : !shown.length ? (
        <Card withBorder p="xl">
          <Text ta="center" c="dimmed">
            {companies?.length
              ? "No companies match."
              : "No companies yet. They're added with applications too."}
          </Text>
        </Card>
      ) : (
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Company</Table.Th>
              <Table.Th>Applications</Table.Th>
              <Table.Th>In progress</Table.Th>
              <Table.Th>Website</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shown.map((c) => {
              const s = stats.get(c.id);
              const open = () => void navigate({ to: `/companies/${c.id}` });
              return (
                <Table.Tr
                  key={c.id}
                  onClick={open}
                  onKeyDown={(e) => e.key === "Enter" && open()}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  aria-label={`Open ${c.name}`}
                >
                  <Table.Td fw={600}>{c.name}</Table.Td>
                  <Table.Td>{s?.total ?? 0}</Table.Td>
                  <Table.Td>
                    {s?.active ?? 0}
                    {s?.stale ? (
                      <Text span c="red" size="xs" ml={6}>
                        {s.stale} to chase
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    {c.website && (
                      <Anchor
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </Anchor>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      <NewCompanyModal opened={creating} onClose={() => setCreating(false)} />
      <Text size="xs" c="dimmed">
        <Anchor component={Link} to="/applications">
          Applications
        </Anchor>{" "}
        create companies as you add them.
      </Text>
    </Stack>
  );
}
