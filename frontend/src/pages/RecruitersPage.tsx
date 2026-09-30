import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconSearch, IconUsers } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { Contact } from "../api/client";
import { useAgencies, useApplications, useContacts } from "../api/hooks";
import { useCreateAgency } from "../api/peopleHooks";
import { ContactCard } from "../components/ContactCard";
import { ContactFormModal } from "../components/ContactFormModal";

function NewAgencyModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const create = useCreateAgency();
  const form = useForm({
    initialValues: { name: "", website: "" },
    validate: {
      name: (v) => (v.trim() ? null : "Name the agency"),
      website: (v) => (!v || /^https?:\/\//.test(v) ? null : "Links start with http:// or https://"),
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="New agency">
      <form
        onSubmit={form.onSubmit((v) =>
          create.mutate(
            { name: v.name.trim(), website: v.website || null },
            {
              onSuccess: () => {
                form.reset();
                onClose();
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
              Add agency
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function RecruitersPage() {
  const { data: agencies, isLoading } = useAgencies();
  const { data: contacts } = useContacts();
  const { data: apps } = useApplications({});
  const [q, setQ] = useState("");
  const [newAgency, setNewAgency] = useState(false);
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined); // undefined = closed, null = new

  const needle = q.trim().toLowerCase();
  const matches = (c: Contact) =>
    !needle ||
    c.name.toLowerCase().includes(needle) ||
    c.details.some((d) => d.value.toLowerCase().includes(needle));
  const activeByAgency = new Map<string, number>();
  for (const a of apps ?? []) {
    if (a.agency_id && a.stage_kind === "active")
      activeByAgency.set(a.agency_id, (activeByAgency.get(a.agency_id) ?? 0) + 1);
  }
  const independent = (contacts ?? []).filter((c) => !c.agency_id && !c.company_id && matches(c));

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="sm">
          <IconUsers size={26} stroke={1.6} />
          <Title order={2}>Recruiters</Title>
        </Group>
        <Group gap="sm">
          <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setNewAgency(true)}>
            New agency
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing(null)}>
            New contact
          </Button>
        </Group>
      </Group>
      <TextInput
        placeholder="Search people, emails, phone numbers"
        leftSection={<IconSearch size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        w={320}
        aria-label="Search recruiters"
      />
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {!agencies?.length && !independent.length && (
            <Card withBorder p="xl">
              <Text ta="center" c="dimmed">
                No recruiters yet. Add an agency, or add one when you create an application.
              </Text>
            </Card>
          )}
          {(agencies ?? []).map((agency) => {
            const people = (contacts ?? []).filter((c) => c.agency_id === agency.id && matches(c));
            if (needle && !people.length && !agency.name.toLowerCase().includes(needle)) return null;
            return (
              <Stack key={agency.id} gap="xs">
                <Group gap="sm">
                  <Anchor component={Link} to={`/agencies/${agency.id}`} fw={700} size="lg">
                    {agency.name}
                  </Anchor>
                  <Badge variant="light" color="gray">
                    {people.length} {people.length === 1 ? "person" : "people"}
                  </Badge>
                  {!!activeByAgency.get(agency.id) && (
                    <Badge variant="light">{activeByAgency.get(agency.id)} in progress</Badge>
                  )}
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                  {people.map((c) => (
                    <ContactCard key={c.id} contact={c} onEdit={() => setEditing(c)} />
                  ))}
                </SimpleGrid>
              </Stack>
            );
          })}
          {!!independent.length && (
            <Stack gap="xs">
              <Text fw={700} size="lg">
                Independent
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {independent.map((c) => (
                  <ContactCard key={c.id} contact={c} onEdit={() => setEditing(c)} />
                ))}
              </SimpleGrid>
            </Stack>
          )}
        </>
      )}
      <NewAgencyModal opened={newAgency} onClose={() => setNewAgency(false)} />
      <ContactFormModal
        opened={editing !== undefined}
        contact={editing}
        onClose={() => setEditing(undefined)}
      />
    </Stack>
  );
}
