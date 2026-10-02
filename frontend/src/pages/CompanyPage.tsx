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
  Textarea,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconBuilding, IconPencil, IconPlus } from "@tabler/icons-react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import type { Schemas } from "../api/client";
import { useCompanySummary, useUpdateCompany } from "../api/detailHooks";
import { stageLookup, useWorkflow } from "../api/hooks";
import { ApplicationDrawer } from "../components/ApplicationDrawer";
import { AttachmentsCard } from "../components/Attachments";
import { ContactFormModal } from "../components/ContactFormModal";
import { DeleteButton } from "../components/DeleteButton";
import { EditNameModal } from "../components/EditNameModal";
import { LinksCard } from "../components/Links";
import { NotesCard } from "../components/Notes";
import { StageBadge } from "../components/StageBadge";
import { ago } from "../utils/time";

function Description({ company }: { company: Schemas["CompanyOut"] }) {
  const update = useUpdateCompany();
  const [text, setText] = useState(company.description ?? "");
  return (
    <Stack gap="xs">
      <Textarea
        label="About"
        placeholder="What they do, tech stack, size, anything worth remembering…"
        autosize
        minRows={3}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button
          size="xs"
          disabled={text === (company.description ?? "")}
          loading={update.isPending}
          onClick={() => update.mutate({ id: company.id, body: { description: text || null } })}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}

export function CompanyPage() {
  const { companyId } = useParams({ from: "/companies/$companyId" });
  const { data, isLoading, isError } = useCompanySummary(companyId);
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const update = useUpdateCompany();
  const router = useRouter();

  if (isError) return <Alert color="red">Couldn't load this company.</Alert>;
  if (isLoading || !data) return <Loader />;
  const { company, roles, applications, contacts } = data;

  return (
    <Stack maw={1200}>
      <Anchor component={Link} to="/companies" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All companies
        </Group>
      </Anchor>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <IconBuilding size={26} stroke={1.6} />
          <Title order={2}>{company.name}</Title>
          {company.website && (
            <Anchor href={company.website} target="_blank" rel="noreferrer" size="sm">
              {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </Anchor>
          )}
        </Group>
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => setEditingName(true)}
          >
            Edit
          </Button>
          <DeleteButton
            kind="company"
            id={company.id}
            name={company.name}
            blocked={
              applications.length
                ? `${company.name} still has ${applications.length === 1 ? "an application. Delete it first, or archive it instead." : `${applications.length} applications. Delete them first, or archive them instead.`}`
                : null
            }
            confirm={`Delete ${company.name} and its roles? Its people stay, without a company.`}
            onDeleted={() => router.history.push("/companies")}
          />
        </Group>
        {editingName && (
          <EditNameModal
            opened
            onClose={() => setEditingName(false)}
            title={`Edit ${company.name}`}
            name={company.name}
            website={company.website}
            saving={update.isPending}
            onSave={(body) =>
              update.mutate({ id: company.id, body }, { onSuccess: () => setEditingName(false) })
            }
          />
        )}
      </Group>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            <Card withBorder>
              <Title order={4} mb="sm">
                Applications
              </Title>
              {!applications.length ? (
                <Text size="sm" c="dimmed">
                  No applications here yet.
                </Text>
              ) : (
                <Table highlightOnHover>
                  <Table.Tbody>
                    {applications.map((a) => (
                      <Table.Tr
                        key={a.id}
                        onClick={() => setOpenId(a.id)}
                        onKeyDown={(e) => e.key === "Enter" && setOpenId(a.id)}
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                      >
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {a.role_title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {a.route === "agency"
                              ? [a.recruiter_name, a.agency_name].filter(Boolean).join(" · ")
                              : a.route === "referral"
                                ? "Referral"
                                : "Direct"}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <StageBadge stage={stages.get(a.stage)} fallback={a.stage_name} />
                            {a.archived && (
                              <Badge size="sm" variant="outline" color="gray">
                                Archived
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={a.stale ? "red" : undefined}>
                            {ago(a.days_since_activity)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
            <Card withBorder>
              <Description key={company.updated_at} company={company} />
            </Card>
            <NotesCard entity={`company:${company.id}`} />
            <LinksCard entityType="company" entityId={company.id} />
            <AttachmentsCard entityType="company" entityId={company.id} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Card withBorder>
              <Title order={4} mb="sm">
                Roles
              </Title>
              <Stack gap={6}>
                {roles.map((r) => (
                  <div key={r.id}>
                    <Group justify="space-between" wrap="nowrap" gap={4}>
                      <Text size="sm" fw={600}>
                        {r.title}
                      </Text>
                      <DeleteButton
                        compact
                        kind="role"
                        id={r.id}
                        name={r.title}
                        confirm={`Delete the role ${r.title}? A role with applications can't be deleted.`}
                      />
                    </Group>
                    <Group gap={6}>
                      {r.work_mode && (
                        <Badge size="xs" variant="light" color="gray">
                          {r.work_mode}
                        </Badge>
                      )}
                      {r.url && (
                        <Anchor href={r.url} target="_blank" rel="noreferrer" size="xs">
                          Job ad
                        </Anchor>
                      )}
                    </Group>
                  </div>
                ))}
                {!roles.length && (
                  <Text size="sm" c="dimmed">
                    No roles yet.
                  </Text>
                )}
              </Stack>
            </Card>
            <Card withBorder>
              <Group justify="space-between" mb="sm">
                <Title order={4}>People</Title>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setAddingPerson(true)}
                >
                  Add person
                </Button>
              </Group>
              <Stack gap={6}>
                {contacts.map((c) => (
                  <div key={c.id}>
                    <Anchor component={Link} to={`/people/${c.id}`} size="sm" fw={600}>
                      {c.name}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {[c.title, ...c.details.map((d) => d.value)].filter(Boolean).join(" · ")}
                    </Text>
                  </div>
                ))}
                {!contacts.length && (
                  <Text size="sm" c="dimmed">
                    No one yet. Add the people you talk to here: in-house recruiters, hiring managers,
                    interviewers.
                  </Text>
                )}
              </Stack>
            </Card>
            <ContactFormModal
              opened={addingPerson}
              onClose={() => setAddingPerson(false)}
              defaultCompanyId={company.id}
            />
          </Stack>
        </Grid.Col>
      </Grid>
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
