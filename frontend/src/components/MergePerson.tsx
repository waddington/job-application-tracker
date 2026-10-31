import { Alert, Button, Group, List, Modal, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowsJoin2, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import type { Contact } from "../api/client";
import { useAgencies, useCompanies, useContacts } from "../api/hooks";
import { useMergeContact } from "../api/peopleHooks";

/** An email address or LinkedIn profile, written the way the server compares them. */
function identities(c: Contact): Set<string> {
  const out = new Set<string>();
  for (const d of c.details) {
    const value = d.value.trim().toLowerCase();
    if (d.kind === "email" && value.includes("@")) out.add(`email:${value}`);
    const m = value.match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/);
    if (m) out.add(`linkedin:${m[1]}`);
  }
  return out;
}

const sameName = (a: Contact, b: Contact) =>
  a.name.trim().toLowerCase().replace(/\s+/g, " ") === b.name.trim().toLowerCase().replace(/\s+/g, " ");

type Why = "email" | "linkedin" | "name";

/** Other people who look like the same person: same name, email address or LinkedIn profile. */
export function likelyDuplicates(person: Contact, everyone: Contact[]): { contact: Contact; why: Why }[] {
  const mine = identities(person);
  const out: { contact: Contact; why: Why }[] = [];
  for (const other of everyone) {
    if (other.id === person.id) continue;
    const shared = [...identities(other)].find((k) => mine.has(k));
    if (shared) out.push({ contact: other, why: shared.startsWith("email") ? "email" : "linkedin" });
    else if (sameName(person, other)) out.push({ contact: other, why: "name" });
  }
  return out;
}

function useWhere() {
  const { data: agencies } = useAgencies();
  const { data: companies } = useCompanies();
  const agency = new Map((agencies ?? []).map((a) => [a.id, a.name]));
  const company = new Map((companies ?? []).map((c) => [c.id, c.name]));
  return (c: Contact) =>
    (c.agency_id && agency.get(c.agency_id)) || (c.company_id && company.get(c.company_id)) || null;
}

function MergeModal({
  person,
  opened,
  onClose,
  initial,
}: {
  person: Contact;
  opened: boolean;
  onClose: () => void;
  initial: string | null;
}) {
  const { t } = useTranslation(["people", "common"]);
  const { data: contacts } = useContacts();
  const merge = useMergeContact();
  const where = useWhere();
  const [fromId, setFromId] = useState<string | null>(initial);
  const everyone = contacts ?? [];
  const likely = likelyDuplicates(person, everyone);
  const likelyIds = new Set(likely.map((l) => l.contact.id));
  const option = (c: Contact) => {
    const place = where(c);
    return place ? t("merge.optionWhere", { name: c.name, where: place }) : c.name;
  };
  const because = (c: Contact, why: Why) =>
    ({
      email: t("merge.reasons.email", { option: option(c) }),
      linkedin: t("merge.reasons.linkedin", { option: option(c) }),
      name: t("merge.reasons.name", { option: option(c) }),
    })[why];
  const data = [
    ...(likely.length
      ? [
          {
            group: t("merge.looksSame"),
            items: likely.map((l) => ({ value: l.contact.id, label: because(l.contact, l.why) })),
          },
        ]
      : []),
    {
      group: t("merge.everyoneElse"),
      items: everyone
        .filter((c) => c.id !== person.id && !likelyIds.has(c.id))
        .map((c) => ({ value: c.id, label: option(c) })),
    },
  ].filter((g) => g.items.length);
  const other = everyone.find((c) => c.id === fromId);

  return (
    <Modal opened={opened} onClose={onClose} title={t("merge.title", { name: person.name })} size="lg">
      <Stack>
        <Text size="sm">
          <Trans t={t} i18nKey="merge.intro" components={{ who: <b>{person.name}</b> }} />
        </Text>
        {data.length ? (
          <Select
            label={t("merge.other")}
            placeholder={t("merge.choose")}
            searchable
            data={data}
            value={fromId}
            onChange={setFromId}
            nothingFoundMessage={t("merge.nobodyFound")}
          />
        ) : (
          <Text size="sm" c="dimmed">
            {t("merge.nobodyElse")}
          </Text>
        )}
        {other && (
          <Alert variant="light" color="blue" icon={<IconArrowsJoin2 size={18} />}>
            <Text size="sm" fw={600} mb={4}>
              {t("merge.fromTo", { from: other.name, to: person.name })}
            </Text>
            <List size="sm" spacing={2}>
              <List.Item>{t("merge.moves.details", { name: person.name })}</List.Item>
              <List.Item>{t("merge.moves.calls")}</List.Item>
              <List.Item>{t("merge.moves.applications")}</List.Item>
              <List.Item>{t("merge.moves.notes")}</List.Item>
              <List.Item>{t("merge.moves.favourite")}</List.Item>
              <List.Item>{t("merge.moves.rest", { name: person.name })}</List.Item>
            </List>
            <Text size="sm" mt={6}>
              {t("merge.thenDeleted", { name: other.name })}
            </Text>
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            disabled={!fromId}
            loading={merge.isPending}
            leftSection={<IconArrowsJoin2 size={16} />}
            onClick={() =>
              fromId &&
              merge.mutate(
                { id: person.id, fromId },
                {
                  onSuccess: () => {
                    notifications.show({
                      color: "green",
                      title: t("merge.merged"),
                      message: other
                        ? t("merge.mergedBody", { from: other.name, to: person.name })
                        : t("merge.mergedBodyUnknown", { to: person.name }),
                    });
                    setFromId(null);
                    onClose();
                  },
                },
              )
            }
          >
            {t("merge.into", { name: person.name })}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** "Merge…" on a person's page. */
export function MergePersonButton({ person }: { person: Contact }) {
  const { t } = useTranslation("people");
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button
        variant="default"
        size="xs"
        leftSection={<IconArrowsJoin2 size={14} />}
        onClick={() => setOpened(true)}
      >
        {t("merge.button")}
      </Button>
      {opened && <MergeModal person={person} opened onClose={() => setOpened(false)} initial={null} />}
    </>
  );
}

const NOT_SAME = "jat.notTheSamePerson";

/** Pairs you've said aren't the same person (in this browser), as "a|b" with the ids sorted. */
function readNotSame(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOT_SAME) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

const pair = (a: string, b: string) => [a, b].sort().join("|");

/** "Alex · Contoso has the same email." One sentence per reason, the name kept out of the markup. */
function SameAs({ why, contact, where }: { why: Why; contact: Contact; where: string | null }) {
  const { t } = useTranslation("people");
  const who = (
    <>
      <b>{contact.name}</b>
      {where ? ` · ${where}` : ""}
    </>
  );
  if (why === "email") return <Trans t={t} i18nKey="merge.hasSame.email" components={{ who }} />;
  if (why === "linkedin") return <Trans t={t} i18nKey="merge.hasSame.linkedin" components={{ who }} />;
  return <Trans t={t} i18nKey="merge.hasSame.name" components={{ who }} />;
}

/** On a person's page: a nudge when someone else looks like the same person. */
export function PossibleDuplicates({ person }: { person: Contact }) {
  const { t } = useTranslation("people");
  const { data: contacts } = useContacts();
  const where = useWhere();
  const [merging, setMerging] = useState<string | null>(null);
  const [notSame, setNotSame] = useState(readNotSame);
  const dismiss = (otherId: string) => {
    const next = new Set(notSame).add(pair(person.id, otherId));
    setNotSame(next);
    try {
      localStorage.setItem(NOT_SAME, JSON.stringify([...next]));
    } catch {
      // No storage (a private window): it's hidden until the page reloads.
    }
  };
  const likely = likelyDuplicates(person, contacts ?? []).filter(
    ({ contact }) => !notSame.has(pair(person.id, contact.id)),
  );
  if (!likely.length) return null;
  const whoWhere = (c: Contact) => {
    const place = where(c);
    return place ? t("merge.whoWhere", { name: c.name, where: place }) : c.name;
  };
  return (
    <Alert variant="light" color="yellow" icon={<IconCopy size={18} />} title={t("merge.duplicate")}>
      <Stack gap={6}>
        {likely.map(({ contact, why }) => (
          <Group key={contact.id} justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm">
              <SameAs why={why} contact={contact} where={where(contact)} />
            </Text>
            <Group gap={6}>
              <Button
                size="compact-xs"
                variant="light"
                aria-label={t("merge.intoThisWho", { who: whoWhere(contact) })}
                onClick={() => setMerging(contact.id)}
              >
                {t("merge.intoThis")}
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                aria-label={t("merge.notSameWho", { who: whoWhere(contact) })}
                onClick={() => dismiss(contact.id)}
              >
                {t("merge.notSame")}
              </Button>
            </Group>
          </Group>
        ))}
      </Stack>
      {merging && <MergeModal person={person} opened onClose={() => setMerging(null)} initial={merging} />}
    </Alert>
  );
}
