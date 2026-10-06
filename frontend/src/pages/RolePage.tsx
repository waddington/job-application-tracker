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
import { IconArrowLeft, IconExternalLink, IconPencil, IconTargetArrow } from "@tabler/icons-react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { stageLookup, useApplications, useWorkflow } from "../api/hooks";
import { ROLE_STATUS, useRoleSummary } from "../api/roleHooks";
import { AttachmentsCard } from "../components/Attachments";
import { DeleteButton } from "../components/DeleteButton";
import { LinksCard } from "../components/Links";
import { Markdown } from "../components/Markdown";
import { NotesCard } from "../components/Notes";
import { pay, RoleActions, RoleFormModal } from "../components/Roles";
import { StageBadge } from "../components/StageBadge";
import { TodosCard } from "../components/Todos";
import { ago, formatDate } from "../utils/time";

const WORK_MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", office: "In the office" };
const EMPLOYMENT: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  fixed_term: "Fixed term",
};
const IR35: Record<string, string> = {
  inside: "Inside IR35",
  outside: "Outside IR35",
  unknown: "IR35 not known",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Text size="sm" fw={600} w={110} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" component="div" style={{ minWidth: 0 }}>
        {children}
      </Text>
    </Group>
  );
}

/** A role's page: what it is, where it came from, what you decided, and everything kept on it. */
export function RolePage() {
  const { roleId } = useParams({ from: "/roles/$roleId" });
  const { data: role, isLoading, isError } = useRoleSummary(roleId);
  const { data: rows } = useApplications({});
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (isError) return <Alert color="red">Couldn't load this role. It may have been deleted.</Alert>;
  if (isLoading || !role) return <Loader />;
  const status = ROLE_STATUS[role.status];
  const money = pay(role);
  const applications = (rows ?? []).filter((r) => r.role_id === role.id);
  const terms = [
    role.employment_type ? EMPLOYMENT[role.employment_type] : null,
    role.work_mode ? WORK_MODE[role.work_mode] : null,
    role.ir35 && role.employment_type === "contract" ? IR35[role.ir35] : null,
  ].filter(Boolean);

  return (
    <Stack maw={1200}>
      <Anchor component={Link} to="/roles" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All roles
        </Group>
      </Anchor>
      <Group justify="space-between" wrap="wrap" align="flex-start">
        <Stack gap={2}>
          <Group gap="sm">
            <IconTargetArrow size={26} stroke={1.6} />
            <Title order={2}>{role.title}</Title>
            <Badge variant="light" color={status.color}>
              {status.label}
            </Badge>
          </Group>
          <Anchor component={Link} to={`/companies/${role.company_id}`} size="lg" ml={38}>
            {role.company_name}
          </Anchor>
        </Stack>
        <Group gap="xs">
          <RoleActions role={role} />
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          {role.status !== "applied" && (
            <DeleteButton
              kind="role"
              id={role.id}
              name={role.title}
              confirm={`Delete the role ${role.title} at ${role.company_name}? Passing on it keeps a record instead.`}
              onDeleted={() => router.history.push("/roles")}
            />
          )}
        </Group>
      </Group>
      {editing && <RoleFormModal opened onClose={() => setEditing(false)} role={role} />}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            <Card withBorder>
              <Stack gap="xs">
                <Title order={4}>About the role</Title>
                {money && <Fact label="Pay">{money}</Fact>}
                {terms.length > 0 && <Fact label="Terms">{terms.join(" · ")}</Fact>}
                {role.location && <Fact label="Location">{role.location}</Fact>}
                {role.url && /^https?:\/\//i.test(role.url) && (
                  <Fact label="Job ad">
                    <Anchor href={role.url} target="_blank" rel="noreferrer noopener" size="sm">
                      <Group gap={4} wrap="nowrap">
                        {role.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        <IconExternalLink size={14} />
                      </Group>
                    </Anchor>
                  </Fact>
                )}
                {role.contact_id && (
                  <Fact label="From">
                    <Anchor component={Link} to={`/people/${role.contact_id}`} size="sm">
                      {role.contact_name}
                    </Anchor>
                    {role.agency_name && role.agency_id && (
                      <>
                        {" at "}
                        <Anchor component={Link} to={`/agencies/${role.agency_id}`} size="sm">
                          {role.agency_name}
                        </Anchor>
                      </>
                    )}
                    {role.meeting_label ? ` · on ${role.meeting_label}` : ""}
                  </Fact>
                )}
                <Fact label="Added">{formatDate(role.created_at.slice(0, 10))}</Fact>
                {role.status === "passed" && (
                  <Fact label="Passed">
                    {role.decided_on ? formatDate(role.decided_on) : "Yes"}
                    {role.decision_reason ? `: ${role.decision_reason}` : ""}
                  </Fact>
                )}
                {role.description ? (
                  <div>
                    <Text size="sm" fw={600} mb={4}>
                      Notes
                    </Text>
                    <Markdown>{role.description}</Markdown>
                  </div>
                ) : (
                  <Text size="sm" c="dimmed">
                    No notes on it yet. Edit adds what they said: team, stack, why it's open.
                  </Text>
                )}
              </Stack>
            </Card>
            {applications.length > 0 && (
              <Card withBorder>
                <Title order={4} mb="sm">
                  {applications.length === 1 ? "Your application" : "Applications"}
                </Title>
                <Table verticalSpacing="xs">
                  <Table.Tbody>
                    {applications.map((a) => (
                      <Table.Tr key={a.id}>
                        <Table.Td>
                          <Anchor component={Link} to={`/applications/${a.id}`} size="sm" fw={600}>
                            {a.company_name} · {a.role_title}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {a.recruiter_name ? `via ${a.recruiter_name}` : "Direct"}
                            {a.applied_on ? ` · applied ${formatDate(a.applied_on)}` : ""}
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
              </Card>
            )}
            <NotesCard entity={`role:${role.id}`} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <TodosCard entityType="role" entityId={role.id} />
            <AttachmentsCard
              entityType="role"
              entityId={role.id}
              empty="Drop the job description here, or a brief. Files here show on the application too, once you apply."
            />
            <LinksCard entityType="role" entityId={role.id} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
