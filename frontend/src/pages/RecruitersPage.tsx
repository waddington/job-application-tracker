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
import { useTranslation } from "react-i18next";

import { ReplyHabit } from "../components/ReplyHabit";
import type { Contact } from "../api/client";
import { FavouriteMark, FavouriteToggle, GhostMark } from "../components/GhostMark";
import { useAgencies, useApplications, useCompanies, useContacts } from "../api/hooks";
import { useCreateAgency } from "../api/peopleHooks";
import { contactHref } from "../components/ContactCard";
import { ContactFormModal } from "../components/ContactFormModal";
import { closedLabel, UndoClosed } from "../components/PersonChase";
import { formatDate } from "../utils/time";

const WEB_LINK = /^https?:\/\//;

function NewAgencyModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation(["people", "common"]);
  const create = useCreateAgency();
  const form = useForm({
    initialValues: { name: "", website: "" },
    validate: {
      name: (v) => (v.trim() ? null : t("recruiters.nameAgency")),
      website: (v) => (!v || WEB_LINK.test(v) ? null : t("places.linkStart")),
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={t("recruiters.newAgency")}>
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
          <TextInput label={t("common:editName.name")} data-autofocus {...form.getInputProps("name")} />
          <TextInput
            label={t("common:editName.website")}
            placeholder={t("common:editName.websitePlaceholder")}
            {...form.getInputProps("website")}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={create.isPending}>
              {t("recruiters.addAgency")}
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
  const { t } = useTranslation("people");
  const ghosted = contact.closed_as === "ghosted";
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
              title={
                contact.favourite && ghosted
                  ? t("recruiters.nameFavouriteGhosted", { name: contact.name })
                  : contact.favourite
                    ? t("recruiters.nameFavourite", { name: contact.name })
                    : ghosted
                      ? t("recruiters.nameGhosted", { name: contact.name })
                      : contact.name
              }
            >
              <FavouriteMark on={contact.favourite} />
              <GhostMark closedAs={contact.closed_as} />
              {contact.name}
            </Anchor>
            {contact.title && (
              <Text size="xs" c="dimmed" truncate="end" title={contact.title}>
                {contact.title}
              </Text>
            )}
          </div>
          <Group gap={0} wrap="nowrap">
            <FavouriteToggle contact={contact} />
            <Tooltip label={t("person.edit")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onEdit}
                aria-label={t("person.editWho", { name: contact.name })}
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        {(where || contact.awaiting_reply_since || contact.reply_to_read_since || contact.closed_as) && (
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
                title={where.name}
              >
                {where.name}
              </Badge>
            )}
            {contact.reply_to_read_since && (
              <Badge size="sm" variant="light" color="orange" style={{ textTransform: "none" }}>
                {t("recruiters.replyToRead")}
              </Badge>
            )}
            {contact.closed_as && (
              <Badge
                size="sm"
                variant="light"
                color="gray"
                style={{ textTransform: "none" }}
                rightSection={<UndoClosed contact={contact} />}
              >
                {contact.closed_on
                  ? t("chase.closedOn", {
                      what: closedLabel(contact.closed_as),
                      date: formatDate(contact.closed_on),
                    })
                  : closedLabel(contact.closed_as)}
              </Badge>
            )}
            {contact.awaiting_reply_since && (
              <Badge size="sm" variant="light" color="grape" style={{ textTransform: "none" }}>
                {t("recruiters.waiting")}
              </Badge>
            )}
          </Group>
        )}
        <ReplyHabit contact={contact} />
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
                  rel={d.kind === "email" || d.kind === "phone" ? undefined : "noreferrer noopener"}
                  truncate="end"
                  title={d.label ? t("person.detailLabelled", { value: d.value, label: d.label }) : d.value}
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

type Show = "all" | "agency" | "company" | "independent" | "favourites" | "ghosted";

export function RecruitersPage() {
  const { t } = useTranslation("people");
  const { data: agencies, isLoading: agenciesLoading } = useAgencies();
  const { data: contacts } = useContacts();
  const { data: apps } = useApplications({});
  const { data: companies } = useCompanies();
  // Wait for everyone and where they work, so no one shows as Independent for a moment.
  const isLoading = agenciesLoading || !contacts || !companies;
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
      if (show === "ghosted") return c.closed_as === "ghosted";
      if (show === "favourites") return c.favourite;
      const kind = whereOf(c)?.kind ?? "independent";
      return show === "all" || show === kind;
    })
    .filter(matches)
    // Favourites first, then A to Z.
    .sort(
      (a, b) =>
        Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

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
          <Title order={2}>{t("recruiters.title")}</Title>
        </Group>
        <Group gap="sm">
          <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setNewAgency(true)}>
            {t("recruiters.newAgency")}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing(null)}>
            {t("recruiters.newPerson")}
          </Button>
        </Group>
      </Group>
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder={t("recruiters.search")}
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={360}
          maw="100%"
          aria-label={t("recruiters.searchLabel")}
        />
        <SegmentedControl
          size="xs"
          value={show}
          onChange={(v) => setShow(v as Show)}
          aria-label={t("recruiters.show")}
          data={[
            { value: "all", label: t("recruiters.all") },
            { value: "agency", label: t("recruiters.agencies") },
            { value: "company", label: t("recruiters.companies") },
            { value: "independent", label: t("recruiters.independent") },
            {
              value: "favourites",
              label: t("recruiters.favourites", { n: (contacts ?? []).filter((c) => c.favourite).length }),
            },
            {
              value: "ghosted",
              label: t("recruiters.ghosted", {
                n: (contacts ?? []).filter((c) => c.closed_as === "ghosted").length,
              }),
            },
          ]}
        />
      </Group>
      {agencyList.length > 0 && (
        <Group gap={6} align="center">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            {t("recruiters.agencies")}
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
                aria-label={
                  active
                    ? t("recruiters.agencyLabelActive", { name: a.name, count: people, active })
                    : t("recruiters.agencyLabel", { name: a.name, count: people })
                }
              >
                {active
                  ? t("recruiters.agencyBadgeActive", { name: a.name, n: people, active })
                  : t("recruiters.agencyBadge", { name: a.name, n: people })}
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
            {needle || show !== "all" ? t("recruiters.noMatches") : t("recruiters.empty")}
          </Text>
        </Card>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            {shown.some((c) => c.favourite)
              ? t("recruiters.countFavourites", { count: shown.length })
              : t("recruiters.count", { count: shown.length })}
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
