import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconBrandLinkedin,
  IconBuilding,
  IconBuildingSkyscraper,
  IconLink,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconPoint,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { Contact } from "../api/client";
import { useAgencies, useApplications, useCompanies, useContacts } from "../api/hooks";
import { useCreateAgency } from "../api/peopleHooks";
import { contactHref } from "../components/ContactCard";
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

const DETAIL_ICONS = {
  email: IconMail,
  phone: IconPhone,
  linkedin: IconBrandLinkedin,
  url: IconLink,
  other: IconPoint,
};

type Where = { kind: "agency" | "company"; id: string; name: string } | null;

/** One person, small: name, title, their agency or company as a chip, every way to reach them. */
function PersonTile({ contact, where, onEdit }: { contact: Contact; where: Where; onEdit: () => void }) {
  return (
    <Card withBorder padding="xs">
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap" gap={4} align="flex-start">
          <div style={{ minWidth: 0 }}>
            <Anchor
              component={Link}
              to={`/people/${contact.id}`}
              fw={600}
              size="sm"
              c="inherit"
              truncate="end"
              display="block"
            >
              {contact.name}
            </Anchor>
            {contact.title && (
              <Text size="xs" c="dimmed" truncate="end" title={contact.title}>
                {contact.title}
              </Text>
            )}
          </div>
          <Tooltip label="Edit">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onEdit}
              aria-label={`Edit ${contact.name}`}
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {(where || contact.awaiting_reply_since || contact.reply_to_read_since) && (
          <Group gap={4}>
            {where && (
              <Badge
                component={Link}
                to={where.kind === "agency" ? `/agencies/${where.id}` : `/companies/${where.id}`}
                size="sm"
                variant="light"
                color={where.kind === "agency" ? "blue" : "teal"}
                leftSection={
                  where.kind === "agency" ? <IconBuildingSkyscraper size={11} /> : <IconBuilding size={11} />
                }
                style={{ cursor: "pointer", textTransform: "none", maxWidth: "100%" }}
              >
                {where.name}
              </Badge>
            )}
            {contact.reply_to_read_since && (
              <Badge size="sm" variant="light" color="orange" style={{ textTransform: "none" }}>
                Reply to read
              </Badge>
            )}
            {contact.awaiting_reply_since && (
              <Badge size="sm" variant="light" color="grape" style={{ textTransform: "none" }}>
                Waiting
              </Badge>
            )}
          </Group>
        )}
        {contact.details.map((d) => {
          const Icon = DETAIL_ICONS[d.kind as keyof typeof DETAIL_ICONS] ?? IconPoint;
          const link = contactHref(d.kind, d.value);
          return (
            <Group key={d.id} gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Icon size={13} stroke={1.6} style={{ flexShrink: 0 }} />
              {link ? (
                <Anchor
                  href={link}
                  size="xs"
                  target={d.kind === "email" || d.kind === "phone" ? undefined : "_blank"}
                  rel="noreferrer noopener"
                  truncate="end"
                  title={d.label ? `${d.value} (${d.label})` : d.value}
                >
                  {d.kind === "linkedin" || d.kind === "url"
                    ? d.value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
                    : d.value}
                </Anchor>
              ) : (
                <Text size="xs" truncate="end" title={d.value}>
                  {d.value}
                </Text>
              )}
            </Group>
          );
        })}
      </Stack>
    </Card>
  );
}

type Show = "all" | "agency" | "company" | "independent";

export function RecruitersPage() {
  const { data: agencies, isLoading } = useAgencies();
  const { data: contacts } = useContacts();
  const { data: apps } = useApplications({});
  const { data: companies } = useCompanies();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [newAgency, setNewAgency] = useState(false);
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined); // undefined = closed, null = new

  const agencyById = new Map((agencies ?? []).map((a) => [a.id, a]));
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
  const whereOf = (c: Contact): Where => {
    const agency = c.agency_id ? agencyById.get(c.agency_id) : undefined;
    if (agency) return { kind: "agency", id: agency.id, name: agency.name };
    const company = c.company_id ? companyById.get(c.company_id) : undefined;
    if (company) return { kind: "company", id: company.id, name: company.name };
    return null;
  };
  const needle = q.trim().toLowerCase();
  // Name, title, agency or company, or any detail (an email, a phone number).
  const matches = (c: Contact) =>
    !needle ||
    [c.name, c.title ?? "", whereOf(c)?.name ?? "", ...c.details.map((d) => d.value)].some((v) =>
      v.toLowerCase().includes(needle),
    );
  const shown = (contacts ?? [])
    .filter((c) => {
      const kind = whereOf(c)?.kind ?? "independent";
      return show === "all" || show === kind;
    })
    .filter(matches)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const peopleByAgency = new Map<string, number>();
  for (const c of contacts ?? [])
    if (c.agency_id) peopleByAgency.set(c.agency_id, (peopleByAgency.get(c.agency_id) ?? 0) + 1);
  const activeByAgency = new Map<string, number>();
  for (const a of apps ?? []) {
    if (a.agency_id && a.stage_kind === "active")
      activeByAgency.set(a.agency_id, (activeByAgency.get(a.agency_id) ?? 0) + 1);
  }
  const agencyList = [...(agencies ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

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
            New person
          </Button>
        </Group>
      </Group>
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search names, agencies, companies, emails, numbers"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={360}
          maw="100%"
          aria-label="Search recruiters"
        />
        <SegmentedControl
          size="sm"
          value={show}
          onChange={(v) => setShow(v as Show)}
          aria-label="Show"
          data={[
            { value: "all", label: "Everyone" },
            { value: "agency", label: "At agencies" },
            { value: "company", label: "At companies" },
            { value: "independent", label: "Independent" },
          ]}
        />
      </Group>
      {agencyList.length > 0 && (
        <Group gap={6} align="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            Agencies
          </Text>
          {agencyList.map((a) => {
            const people = peopleByAgency.get(a.id) ?? 0;
            const active = activeByAgency.get(a.id) ?? 0;
            return (
              <Badge
                key={a.id}
                component={Link}
                to={`/agencies/${a.id}`}
                variant="outline"
                color="blue"
                size="md"
                style={{ cursor: "pointer", textTransform: "none" }}
                aria-label={`${a.name}: ${people} ${people === 1 ? "person" : "people"}${active ? `, ${active} in progress` : ""}`}
              >
                {a.name} · {people}
                {active ? ` · ${active} in progress` : ""}
              </Badge>
            );
          })}
        </Group>
      )}
      {isLoading ? (
        <Loader />
      ) : !shown.length ? (
        <Card withBorder p="xl">
          <Text ta="center" c="dimmed">
            {needle || show !== "all"
              ? "No matches."
              : "No one yet. Add a person, or an agency, or add them when you create an application."}
          </Text>
        </Card>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            {shown.length} {shown.length === 1 ? "person" : "people"}, A to Z
          </Text>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 4 }} spacing="sm" verticalSpacing="sm">
            {shown.map((c) => (
              <PersonTile key={c.id} contact={c} where={whereOf(c)} onEdit={() => setEditing(c)} />
            ))}
          </SimpleGrid>
        </>
      )}
      <NewAgencyModal opened={newAgency} onClose={() => setNewAgency(false)} />
      <ContactFormModal
        key={editing?.id ?? "new"}
        opened={editing !== undefined}
        contact={editing}
        onClose={() => setEditing(undefined)}
      />
    </Stack>
  );
}
