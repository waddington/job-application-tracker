import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";

import type { ApplicationDetail } from "../api/client";
import { useLinkContact, useUnlinkContact } from "../api/detailHooks";
import { useApplication, useContacts, useRoles, useUpdateApplication } from "../api/hooks";
import {
  ApplicationLoadError,
  ApplicationSummary,
  ApplicationTimeline,
  LogActivity,
} from "../components/ApplicationDrawer";
import { AttachmentsCard } from "../components/Attachments";
import { LinksCard } from "../components/Links";
import { NotesCard } from "../components/Notes";
import { relationLabel, RELATIONS, type Relation } from "../api/peopleHooks";
import { ContactFormModal } from "../components/ContactFormModal";
import { DeleteButton } from "../components/DeleteButton";
import { OffersCard } from "../components/Offers";
import { SentDocumentsCard } from "../components/SentDocuments";
import { InterviewsCard } from "../components/Interviews";

const toDate = (value: string | null) => (value ? dayjs(value).format("YYYY-MM-DD") : null);

function DetailsCard({ app }: { app: ApplicationDetail }) {
  const update = useUpdateApplication();
  const [appliedOn, setAppliedOn] = useState<string | null>(app.applied_on);
  const [followUp, setFollowUp] = useState<string | null>(app.follow_up_on);
  const [snoozed, setSnoozed] = useState<string | null>(app.snoozed_until);
  const [tags, setTags] = useState<string[]>(app.tags);
  const dirty =
    appliedOn !== app.applied_on ||
    followUp !== app.follow_up_on ||
    snoozed !== app.snoozed_until ||
    tags.join("\u0000") !== app.tags.join("\u0000");

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>Details</Title>
        <Group grow align="flex-start">
          <DateInput
            label="Applied on"
            clearable
            value={appliedOn}
            onChange={(v) => setAppliedOn(toDate(v))}
          />
          <DateInput
            label="Follow up on"
            description="Shows in Next actions on this date"
            clearable
            value={followUp}
            onChange={(v) => setFollowUp(toDate(v))}
          />
          <DateInput
            label="Snooze until"
            description="Won't be flagged as stale before then"
            clearable
            value={snoozed}
            onChange={(v) => setSnoozed(toDate(v))}
          />
        </Group>
        <TagsInput label="Tags" value={tags} onChange={setTags} />
        <Group justify="space-between">
          <Switch
            label="Archived"
            checked={app.archived}
            onChange={(e) => update.mutate({ id: app.id, body: { archived: e.currentTarget.checked } })}
          />
          <Button
            disabled={!dirty}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  id: app.id,
                  body: { applied_on: appliedOn, follow_up_on: followUp, snoozed_until: snoozed, tags },
                },
                {
                  // Take whatever the server stored (e.g. normalised values) as the new baseline.
                  onSuccess: (saved) => {
                    setAppliedOn(saved.applied_on);
                    setFollowUp(saved.follow_up_on);
                    setSnoozed(saved.snoozed_until);
                    setTags(saved.tags);
                  },
                },
              )
            }
          >
            Save details
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function PeopleCard({ app }: { app: ApplicationDetail }) {
  const { data: contacts } = useContacts();
  const link = useLinkContact();
  const unlink = useUnlinkContact();
  const [contactId, setContactId] = useState<string | null>(null);
  const [relation, setRelation] = useState<string | null>("interviewer");
  const [creating, setCreating] = useState(false);
  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));
  const linkAs = (id: string) =>
    link.mutate(
      { appId: app.id, contactId: id, relation: (relation ?? "other") as Relation },
      { onSuccess: () => setContactId(null) },
    );

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>People</Title>
        {app.contacts.length === 0 && (
          <Text size="sm" c="dimmed">
            No one linked yet. Add recruiters, hiring managers and interviewers.
          </Text>
        )}
        {app.contacts.map((l) => {
          const person = byId.get(l.contact_id);
          const email = person?.details.find((d) => d.kind === "email")?.value;
          return (
            <Group key={l.id} justify="space-between" wrap="nowrap">
              <div>
                {person ? (
                  <Anchor component={Link} to={`/people/${person.id}`} size="sm" fw={600}>
                    {person.name}
                  </Anchor>
                ) : (
                  <Text size="sm" fw={600}>
                    Unknown contact
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {relationLabel(l.relation)}
                  {email ? ` · ${email}` : ""}
                </Text>
              </div>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Remove ${person?.name ?? "contact"}`}
                onClick={() => unlink.mutate({ appId: app.id, linkId: l.id })}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          );
        })}
        <Divider />
        <Group grow align="flex-end">
          <Select
            label="Add a person"
            placeholder="Choose a contact"
            searchable
            data={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={contactId}
            onChange={setContactId}
          />
          <Select label="As" data={RELATIONS} value={relation} onChange={setRelation} allowDeselect={false} />
        </Group>
        <Group grow>
          <Button
            variant="light"
            disabled={!contactId || !relation}
            loading={link.isPending}
            onClick={() => contactId && linkAs(contactId)}
          >
            Link person
          </Button>
          <Button variant="default" leftSection={<IconPlus size={14} />} onClick={() => setCreating(true)}>
            New person
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Someone new? <b>New person</b> adds them (at {app.company_name} unless you change it) and links them
          as the role chosen above.
        </Text>
      </Stack>
      <ContactFormModal
        opened={creating}
        onClose={() => setCreating(false)}
        defaultCompanyId={app.company_id}
        onSaved={(saved) => linkAs(saved.id)}
      />
    </Card>
  );
}

function RoleCard({ app }: { app: ApplicationDetail }) {
  const { data: roles } = useRoles();
  const role = roles?.find((r) => r.id === app.role_id);
  return (
    <Card withBorder>
      <Stack gap={6}>
        <Title order={4}>Role</Title>
        <Text size="sm" fw={600}>
          {app.role_title}
        </Text>
        <Anchor component={Link} to={`/companies/${app.company_id}`} size="sm">
          {app.company_name}
        </Anchor>
        {role?.location && <Text size="sm">{role.location}</Text>}
        {role?.work_mode && (
          <Text size="sm" tt="capitalize">
            {role.work_mode}
          </Text>
        )}
        {role?.url && (
          <Anchor href={role.url} target="_blank" rel="noreferrer" size="sm">
            Job ad
          </Anchor>
        )}
      </Stack>
    </Card>
  );
}

export function ApplicationPage() {
  const { appId } = useParams({ from: "/applications/$appId" });
  const { data: app, isLoading, isError, error } = useApplication(appId);
  const router = useRouter();

  return (
    <Stack maw={1200}>
      <Group justify="space-between">
        <Anchor component={Link} to="/applications" size="sm">
          <Group gap={4}>
            <IconArrowLeft size={14} /> All applications
          </Group>
        </Anchor>
        {app && (
          <DeleteButton
            kind="application"
            id={app.id}
            name={`${app.company_name} · ${app.role_title}`}
            confirm={
              `Delete your application to ${app.company_name} (${app.role_title})? Its interviews, ` +
              "offer, timeline and record of documents sent go with it; notes and files stay. " +
              "To keep it but hide it, archive it instead."
            }
            onDeleted={() => router.history.push("/applications")}
          />
        )}
      </Group>
      {isError ? (
        <ApplicationLoadError error={error} />
      ) : isLoading || !app ? (
        <Loader />
      ) : (
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack>
              <ApplicationSummary app={app} />
              {/* keyed by id, not updated_at: other changes (archive, moves) keep unsaved edits */}
              <DetailsCard key={app.id} app={app} />
              <InterviewsCard applicationId={app.id} />
              <SentDocumentsCard app={app} />
              <OffersCard applicationId={app.id} roleId={app.role_id} />
              <NotesCard entity={`application:${app.id}`} />
              <LinksCard entityType="application" entityId={app.id} />
              <AttachmentsCard entityType="application" entityId={app.id} />
              <Card withBorder>
                <Stack gap="sm">
                  <Title order={4}>Log activity</Title>
                  <LogActivity key={app.id} id={app.id} />
                </Stack>
              </Card>
              <Card withBorder>
                <Stack gap="sm">
                  <Title order={4}>Timeline</Title>
                  <ApplicationTimeline app={app} />
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack>
              <RoleCard app={app} />
              <PeopleCard app={app} />
            </Stack>
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
