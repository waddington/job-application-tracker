import { Alert, Anchor, Badge, Button, Card, Group, Stack, Table, Text, Title } from "@mantine/core";
import { IconPencil, IconUser } from "@tabler/icons-react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BackLink, Page } from "../components/Page";
import { RecordSkeleton } from "../components/PageSkeleton";
import { RecordLayout } from "../components/RecordLayout";
import { RecruiterLine } from "../components/RecruiterLine";
import { ReplyHabit } from "../components/ReplyHabit";
import { stageLookup, useWorkflow } from "../api/hooks";
import { relationLabel, useContactSummary } from "../api/peopleHooks";
import { AttachmentsCard } from "../components/Attachments";
import { ContactCard } from "../components/ContactCard";
import { ContactFormModal } from "../components/ContactFormModal";
import { DeleteButton } from "../components/DeleteButton";
import { roundStatus } from "../components/Interviews";
import { roundLabel } from "../utils/rounds";
import { LinksCard } from "../components/Links";
import { TodosCard } from "../components/Todos";
import { MeetingsCard, useRebookTodoIds } from "../components/Meetings";
import { RolesCard } from "../components/Roles";
import { FavouriteToggle, GhostMark } from "../components/GhostMark";
import { MergePersonButton, PossibleDuplicates } from "../components/MergePerson";
import { TimelineButton } from "../components/TimelineButton";
import { NotesCard } from "../components/Notes";
import { StageBadge } from "../components/StageBadge";
import { PersonChase, PersonClosed } from "../components/PersonChase";
import { PersonWaiting } from "../components/Waiting";
import { joinList } from "../utils/list";
import { ago, formatDateTime } from "../utils/time";

/** A person's page: who they are, how to reach them, what they've been part of, and your notes. */
export function PersonPage() {
  const { t } = useTranslation("people");
  const { personId } = useParams({ from: "/people/$personId" });
  const { data, isError } = useContactSummary(personId);
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const rebookTodoIds = useRebookTodoIds(personId);

  const back = <BackLink to="/recruiters">{t("person.allPeople")}</BackLink>;
  if (isError)
    return (
      <Page>
        {back}
        <Alert color="red">{t("person.loadFailed")}</Alert>
      </Page>
    );
  if (!data)
    return (
      <RecordSkeleton
        back={back}
        lines={[25, 21]}
        actions={9}
        main={[182]}
        second={[182, 200, 117]}
        side={[120, 214, 216]}
      />
    );
  const { contact, agency_name, company_name, applications, interviews } = data;
  const where = contact.agency_id ? (
    <Anchor component={Link} to={`/agencies/${contact.agency_id}`}>
      {agency_name}
    </Anchor>
  ) : contact.company_id ? (
    <Anchor component={Link} to={`/companies/${contact.company_id}`}>
      {company_name}
    </Anchor>
  ) : null;

  return (
    <Page>
      {back}
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm" align="flex-start">
          {contact.closed_as === "ghosted" ? (
            <span style={{ marginTop: 4 }}>
              <GhostMark closedAs="ghosted" size={26} />
            </span>
          ) : (
            <IconUser size={26} stroke={1.6} style={{ marginTop: 4 }} />
          )}
          <div>
            <Group gap={4} wrap="nowrap">
              <Title order={2}>{contact.name}</Title>
              <FavouriteToggle contact={contact} size="md" />
            </Group>
            <Text c="dimmed">
              {contact.title}
              {contact.title && where ? " · " : ""}
              {where}
            </Text>
            <ReplyHabit contact={contact} size="sm" />
          </div>
        </Group>
        <Group gap="xs">
          <PersonClosed contact={contact} />
          <PersonWaiting
            id={contact.id}
            since={contact.awaiting_reply_since}
            toRead={contact.reply_to_read_since}
          />
          {!contact.closed_as && <PersonChase contact={contact} />}
          <TimelineButton kind="contact" id={contact.id} name={contact.name} />
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => setEditing(true)}
          >
            {t("person.edit")}
          </Button>
          <MergePersonButton person={contact} />
          <DeleteButton
            kind="contact"
            id={contact.id}
            name={contact.name}
            confirm={t("person.deleteConfirm", { name: contact.name })}
            onDeleted={() => router.history.push("/recruiters")}
          />
        </Group>
      </Group>
      <PossibleDuplicates person={contact} />
      <RecordLayout
        main={[
          // Your calls with them; then what they're part of, and your notes. Stacked, that's the order the
          // page always had.
          <MeetingsCard contactId={contact.id} name={contact.name} />,
          <>
            <RolesCard
              title={t("person.rolesTitle")}
              filters={{ contact_id: contact.id }}
              start={{ contactId: contact.id }}
              empty={t("person.rolesEmpty", { name: contact.name })}
              showSource={false}
            />
            <Card withBorder>
              <Title order={4} mb="sm">
                {t("person.applications")}
              </Title>
              {!applications.length ? (
                <Text size="sm" c="dimmed">
                  {t("person.noApplications")}
                </Text>
              ) : (
                <Table highlightOnHover>
                  <Table.Tbody>
                    {applications.map((a) => (
                      <Table.Tr key={a.id}>
                        <Table.Td>
                          <Text size="sm">
                            {/* Who brought it, unless that's this person (it says so underneath). */}
                            <RecruiterLine
                              id={a.recruiter_id}
                              name={a.recruiter_id === contact.id ? null : a.recruiter_name}
                            >
                              <Anchor component={Link} to={`/applications/${a.id}`} inherit fw={600}>
                                {a.company_name} · {a.role_title}
                              </Anchor>
                            </RecruiterLine>
                          </Text>
                          <Text size="xs" c="dimmed">
                            {joinList(
                              a.relations.map((r) =>
                                r === "source" ? t("person.broughtIt") : relationLabel(r),
                              ),
                            )}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <StageBadge
                            id={a.stage}
                            stage={stages.get(a.stage)}
                            fallback={a.stage_name}
                            whole
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {ago(a.days_since_activity)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
            {interviews.length > 0 && (
              <Card withBorder>
                <Title order={4} mb="sm">
                  {t("person.interviews")}
                </Title>
                <Stack gap="xs">
                  {interviews.map((i) => (
                    <Group key={i.id} justify="space-between" wrap="nowrap">
                      <div>
                        <Anchor component={Link} to={`/applications/${i.application_id}`} size="sm" fw={600}>
                          {roundLabel(i)}
                        </Anchor>
                        <Text size="xs" c="dimmed">
                          <RecruiterLine
                            id={i.recruiter_id}
                            name={i.recruiter_id === contact.id ? null : i.recruiter_name}
                          >
                            {i.company_name} · {i.role_title}
                          </RecruiterLine>
                          {i.starts_at ? ` · ${formatDateTime(i.starts_at)}` : ""}
                        </Text>
                      </div>
                      <Badge size="sm" variant="light" color={roundStatus(i).color}>
                        {roundStatus(i).label}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Card>
            )}
            <NotesCard entity={`contact:${contact.id}`} />
          </>,
        ]}
        side={
          <>
            <ContactCard contact={contact} />
            <TodosCard entityType="contact" entityId={contact.id} shownElsewhere={rebookTodoIds} />
            <LinksCard entityType="contact" entityId={contact.id} />
            <AttachmentsCard entityType="contact" entityId={contact.id} />
          </>
        }
      />
      <ContactFormModal opened={editing} onClose={() => setEditing(false)} contact={contact} />
    </Page>
  );
}
