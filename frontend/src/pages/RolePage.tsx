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
import { Trans, useTranslation } from "react-i18next";

import { PersonName } from "../components/GhostMark";
import { stageLookup, useApplications, useWorkflow } from "../api/hooks";
import { roleBadge, useRoleSummary, type RoleSummary } from "../api/roleHooks";
import { AttachmentsCard } from "../components/Attachments";
import { DeleteButton } from "../components/DeleteButton";
import { LinksCard } from "../components/Links";
import { Markdown } from "../components/Markdown";
import { NotesCard } from "../components/Notes";
import { pay, RoleActions, RoleFormModal } from "../components/Roles";
import { StageBadge } from "../components/StageBadge";
import { TodosCard } from "../components/Todos";
import { callLabel } from "../utils/calls";
import { ago, formatDate } from "../utils/time";

const WORK_MODE = {
  remote: "page.workModes.remote",
  hybrid: "page.workModes.hybrid",
  office: "page.workModes.office",
} as const;
const EMPLOYMENT = {
  permanent: "page.types.permanent",
  contract: "page.types.contract",
  fixed_term: "page.types.fixed_term",
} as const;

/** The key for a known value, or null for one the app doesn't know (it isn't shown). */
const lookup = <M extends Record<string, string>>(map: M, value: string | null | undefined) =>
  value && Object.hasOwn(map, value) ? map[value as keyof M] : null;

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

/** The call a role came up in, named in your language. */
function callOf(role: RoleSummary) {
  if (!role.meeting_kind) return null;
  return callLabel({
    kind: role.meeting_kind,
    title: role.meeting_title ?? null,
    contact_name: role.meeting_contact_name ?? "",
  });
}

/** A role's page: what it is, where it came from, what you decided, and everything kept on it. */
export function RolePage() {
  const { t } = useTranslation("roles");
  const { roleId } = useParams({ from: "/roles/$roleId" });
  const { data: role, isLoading, isError } = useRoleSummary(roleId);
  const { data: rows } = useApplications({});
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (isError) return <Alert color="red">{t("page.loadFailed")}</Alert>;
  if (isLoading || !role) return <Loader />;
  const status = roleBadge(role);
  const money = pay(role);
  const applications = (rows ?? []).filter((r) => r.role_id === role.id);
  const terms = [lookup(EMPLOYMENT, role.employment_type), lookup(WORK_MODE, role.work_mode)]
    .filter((key) => key !== null)
    .map((key) => t(key));

  return (
    <Stack maw={1200}>
      <Anchor component={Link} to="/roles" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> {t("page.back")}
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
            {t("page.edit")}
          </Button>
          {role.application_ids.length === 0 && (
            <DeleteButton
              kind="role"
              id={role.id}
              name={role.title}
              confirm={t("line.deleteConfirm", { role: role.title, company: role.company_name })}
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
                <Title order={4}>{t("page.about")}</Title>
                {money && <Fact label={t("page.facts.pay")}>{money}</Fact>}
                {terms.length > 0 && (
                  <Fact label={t("page.facts.terms")}>{terms.join(t("page.termsSeparator"))}</Fact>
                )}
                {role.location && <Fact label={t("page.facts.location")}>{role.location}</Fact>}
                {role.url && /^https?:\/\//i.test(role.url) && (
                  <Fact label={t("page.facts.jobAd")}>
                    <Anchor href={role.url} target="_blank" rel="noreferrer noopener" size="sm">
                      <Group gap={4} wrap="nowrap">
                        {role.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        <IconExternalLink size={14} />
                      </Group>
                    </Anchor>
                  </Fact>
                )}
                {role.contact_id && (
                  <Fact label={t("page.facts.from")}>
                    <Trans
                      t={t}
                      i18nKey={
                        role.agency_name && role.agency_id
                          ? callOf(role)
                            ? "page.fromPersonAgencyCall"
                            : "page.fromPersonAgency"
                          : callOf(role)
                            ? "page.fromPersonCall"
                            : "page.fromPerson"
                      }
                      components={{
                        person: (
                          <Anchor component={Link} to={`/people/${role.contact_id}`} size="sm">
                            <PersonName id={role.contact_id} name={role.contact_name ?? ""} />
                          </Anchor>
                        ),
                        agency: (
                          <Anchor component={Link} to={`/agencies/${role.agency_id}`} size="sm">
                            {role.agency_name}
                          </Anchor>
                        ),
                        // A component, not a value: <Trans> would read a "<" you typed as markup.
                        call: <>{callOf(role)}</>,
                      }}
                    />
                  </Fact>
                )}
                <Fact label={t("page.facts.added")}>{formatDate(role.created_at.slice(0, 10))}</Fact>
                {role.status === "passed" && (
                  <Fact label={t("page.facts.passed")}>
                    {role.decision_reason
                      ? t("page.passedWhy", {
                          when: role.decided_on ? formatDate(role.decided_on) : t("page.passedYes"),
                          reason: role.decision_reason,
                        })
                      : role.decided_on
                        ? formatDate(role.decided_on)
                        : t("page.passedYes")}
                  </Fact>
                )}
                {role.description ? (
                  <div>
                    <Text size="sm" fw={600} mb={4}>
                      {t("page.whatTheySaid")}
                    </Text>
                    <Markdown>{role.description}</Markdown>
                  </div>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("page.noDescription")}
                  </Text>
                )}
              </Stack>
            </Card>
            {applications.length > 0 && (
              <Card withBorder>
                <Title order={4} mb="sm">
                  {/* Not a plural: no number is shown, and "one" means 21 too in some languages. */}
                  {applications.length === 1 ? t("page.yourApplication") : t("page.applications")}
                </Title>
                <Table verticalSpacing="xs">
                  <Table.Tbody>
                    {applications.map((a) => (
                      <Table.Tr key={a.id}>
                        <Table.Td>
                          <Anchor component={Link} to={`/applications/${a.id}`} size="sm" fw={600}>
                            {t("page.applicationName", { company: a.company_name, role: a.role_title })}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {a.recruiter_name ? (
                              <Trans
                                t={t}
                                i18nKey={a.applied_on ? "page.viaApplied" : "page.via"}
                                values={{ date: formatDate(a.applied_on) }}
                                components={{
                                  person: (
                                    <PersonName id={a.recruiter_id} name={a.recruiter_name} size={12} />
                                  ),
                                }}
                              />
                            ) : a.applied_on ? (
                              t("page.directApplied", { date: formatDate(a.applied_on) })
                            ) : (
                              t("page.direct")
                            )}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <StageBadge id={a.stage} stage={stages.get(a.stage)} fallback={a.stage_name} />
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
            <AttachmentsCard entityType="role" entityId={role.id} empty={t("page.filesEmpty")} />
            <LinksCard entityType="role" entityId={role.id} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
