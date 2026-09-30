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
import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";

import type { ApplicationDetail, Schemas } from "../api/client";
import { useLinkContact, useUnlinkContact } from "../api/detailHooks";
import { useApplication, useContacts, useRoles, useUpdateApplication } from "../api/hooks";
import {
  ApplicationLoadError,
  ApplicationSummary,
  ApplicationTimeline,
  LogActivity,
} from "../components/ApplicationDrawer";

const RELATIONS: { value: Schemas["ApplicationContactIn"]["relation"]; label: string }[] = [
  { value: "recruiter", label: "Recruiter" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "interviewer", label: "Interviewer" },
  { value: "referrer", label: "Referrer" },
  { value: "other", label: "Other" },
];

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
  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));
  const relationLabel = new Map(RELATIONS.map((r) => [r.value as string, r.label]));

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
                <Text size="sm" fw={600}>
                  {person?.name ?? "Unknown contact"}
                </Text>
                <Text size="xs" c="dimmed">
                  {relationLabel.get(l.relation) ?? l.relation}
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
        <Button
          variant="light"
          disabled={!contactId || !relation}
          loading={link.isPending}
          onClick={() =>
            contactId &&
            relation &&
            link.mutate(
              { appId: app.id, contactId, relation: relation as Schemas["ApplicationContactIn"]["relation"] },
              { onSuccess: () => setContactId(null) },
            )
          }
        >
          Link person
        </Button>
      </Stack>
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

  return (
    <Stack maw={1200}>
      <Anchor component={Link} to="/applications" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All applications
        </Group>
      </Anchor>
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
