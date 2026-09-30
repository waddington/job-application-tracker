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
import { IconArrowLeft, IconBuilding } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";

import type { Schemas } from "../api/client";
import { useCompanySummary, useUpdateCompany } from "../api/detailHooks";
import { stageLookup, useWorkflow } from "../api/hooks";
import { ApplicationDrawer } from "../components/ApplicationDrawer";
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
      <Group gap="sm">
        <IconBuilding size={26} stroke={1.6} />
        <Title order={2}>{company.name}</Title>
        {company.website && (
          <Anchor href={company.website} target="_blank" rel="noreferrer" size="sm">
            {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </Anchor>
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
                    <Text size="sm" fw={600}>
                      {r.title}
                    </Text>
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
              <Title order={4} mb="sm">
                People
              </Title>
              <Stack gap={6}>
                {contacts.map((c) => (
                  <div key={c.id}>
                    <Text size="sm" fw={600}>
                      {c.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {[c.title, ...c.details.map((d) => d.value)].filter(Boolean).join(" · ")}
                    </Text>
                  </div>
                ))}
                {!contacts.length && (
                  <Text size="sm" c="dimmed">
                    No one yet. Link people from an application page.
                  </Text>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
