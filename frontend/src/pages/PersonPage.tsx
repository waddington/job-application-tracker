import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPencil, IconUser } from "@tabler/icons-react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { stageLookup, useWorkflow } from "../api/hooks";
import { relationLabel, useContactSummary } from "../api/peopleHooks";
import { AttachmentsCard } from "../components/Attachments";
import { ContactCard } from "../components/ContactCard";
import { ContactFormModal } from "../components/ContactFormModal";
import { DeleteButton } from "../components/DeleteButton";
import { roundStatus } from "../components/Interviews";
import { LinksCard } from "../components/Links";
import { MeetingsCard } from "../components/Meetings";
import { RolesCard } from "../components/Roles";
import { NotesCard } from "../components/Notes";
import { StageBadge } from "../components/StageBadge";
import { PersonWaiting } from "../components/Waiting";
import { ago, formatDateTime } from "../utils/time";

/** A person's page: who they are, how to reach them, what they've been part of, and your notes. */
export function PersonPage() {
  const { personId } = useParams({ from: "/people/$personId" });
  const { data, isLoading, isError } = useContactSummary(personId);
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (isError) return <Alert color="red">Couldn't load this person.</Alert>;
  if (isLoading || !data) return <Loader />;
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
    <Stack maw={1200}>
      <Anchor component={Link} to="/recruiters" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All people
        </Group>
      </Anchor>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm" align="flex-start">
          <IconUser size={26} stroke={1.6} style={{ marginTop: 4 }} />
          <div>
            <Title order={2}>{contact.name}</Title>
            <Text c="dimmed">
              {contact.title}
              {contact.title && where ? " · " : ""}
              {where}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <PersonWaiting id={contact.id} since={contact.awaiting_reply_since} />
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <DeleteButton
            kind="contact"
            id={contact.id}
            name={contact.name}
            confirm={`Delete ${contact.name}? They come off the applications and interviews they're on, and their calls are deleted; the applications themselves stay.`}
            onDeleted={() => router.history.push("/recruiters")}
          />
        </Group>
      </Group>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            <MeetingsCard contactId={contact.id} name={contact.name} />
            <RolesCard
              title="Roles they've mentioned"
              filters={{ contact_id: contact.id }}
              start={{ contactId: contact.id }}
              empty={`No roles from ${contact.name} yet. Add the ones they mention, then apply or pass on each.`}
              showSource={false}
            />
            <Card withBorder>
              <Title order={4} mb="sm">
                Applications
              </Title>
              {!applications.length ? (
                <Text size="sm" c="dimmed">
                  Not linked to any applications yet. Link them from an application's People card.
                </Text>
              ) : (
                <Table highlightOnHover>
                  <Table.Tbody>
                    {applications.map((a) => (
                      <Table.Tr key={a.id}>
                        <Table.Td>
                          <Anchor component={Link} to={`/applications/${a.id}`} size="sm" fw={600}>
                            {a.company_name} · {a.role_title}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {a.relations
                              .map((r) => (r === "source" ? "Brought it to you" : relationLabel(r)))
                              .join(", ")}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <StageBadge stage={stages.get(a.stage)} fallback={a.stage_name} />
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
                  Interviews
                </Title>
                <Stack gap="xs">
                  {interviews.map((i) => (
                    <Group key={i.id} justify="space-between" wrap="nowrap">
                      <div>
                        <Anchor component={Link} to={`/applications/${i.application_id}`} size="sm" fw={600}>
                          {i.label}
                        </Anchor>
                        <Text size="xs" c="dimmed">
                          {i.company_name} · {i.role_title}
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
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <ContactCard contact={contact} />
            <LinksCard entityType="contact" entityId={contact.id} />
            <AttachmentsCard entityType="contact" entityId={contact.id} />
          </Stack>
        </Grid.Col>
      </Grid>
      <ContactFormModal opened={editing} onClose={() => setEditing(false)} contact={contact} />
    </Stack>
  );
}
