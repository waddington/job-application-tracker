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
import { IconArrowLeft, IconPencil, IconPlus, IconUsers } from "@tabler/icons-react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonName } from "../components/GhostMark";
import type { Contact } from "../api/client";
import { useAgencySummary } from "../api/detailHooks";
import { stageLookup, useWorkflow } from "../api/hooks";
import { useUpdateAgency } from "../api/peopleHooks";
import { ApplicationDrawer } from "../components/ApplicationDrawer";
import { TimelineButton } from "../components/TimelineButton";
import { AttachmentsCard } from "../components/Attachments";
import { LinksCard } from "../components/Links";
import { TodosCard } from "../components/Todos";
import { NotesCard } from "../components/Notes";
import { ContactCard } from "../components/ContactCard";
import { DeleteButton } from "../components/DeleteButton";
import { EditNameModal } from "../components/EditNameModal";
import { ContactFormModal } from "../components/ContactFormModal";
import { StageBadge } from "../components/StageBadge";
import { ago } from "../utils/time";

export function AgencyPage() {
  const { t } = useTranslation("people");
  const { agencyId } = useParams({ from: "/agencies/$agencyId" });
  const { data, isLoading, isError } = useAgencySummary(agencyId);
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const updateAgency = useUpdateAgency();

  if (isError) return <Alert color="red">{t("agency.loadFailed")}</Alert>;
  if (isLoading || !data) return <Loader />;
  const { agency, recruiters, applications } = data;

  return (
    <Stack maw={1200}>
      <Anchor component={Link} to="/recruiters" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> {t("agency.all")}
        </Group>
      </Anchor>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <IconUsers size={26} stroke={1.6} />
          <Title order={2}>{agency.name}</Title>
          {agency.website && /^https?:\/\//i.test(agency.website) && (
            <Anchor href={agency.website} target="_blank" rel="noreferrer" size="sm">
              {agency.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </Anchor>
          )}
        </Group>
        <Group gap="xs">
          <TimelineButton kind="agency" id={agency.id} name={agency.name} />
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => setEditingName(true)}
          >
            {t("places.edit")}
          </Button>
          <DeleteButton
            kind="agency"
            id={agency.id}
            name={agency.name}
            confirm={t("agency.deleteConfirm", { name: agency.name })}
            onDeleted={() => router.history.push("/recruiters")}
          />
        </Group>
        {editingName && (
          <EditNameModal
            opened
            onClose={() => setEditingName(false)}
            title={t("places.editName", { name: agency.name })}
            name={agency.name}
            website={agency.website}
            saving={updateAgency.isPending}
            onSave={(body) =>
              updateAgency.mutate({ id: agency.id, body }, { onSuccess: () => setEditingName(false) })
            }
          />
        )}
      </Group>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder>
            <Title order={4} mb="sm">
              {t("agency.rolesThrough", { name: agency.name })}
            </Title>
            {!applications.length ? (
              <Text size="sm" c="dimmed">
                {t("agency.nothingYet")}
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
                          {a.company_name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {a.role_title}
                          {a.recruiter_name && (
                            <>
                              {" · "}
                              <PersonName id={a.recruiter_id} name={a.recruiter_name} size={12} />
                            </>
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <StageBadge stage={stages.get(a.stage)} fallback={a.stage_name} />
                          {a.archived && (
                            <Badge size="sm" variant="outline" color="gray">
                              {t("agency.archived")}
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
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <TodosCard entityType="agency" entityId={agency.id} />
            <Group justify="space-between">
              <Title order={4}>{t("agency.recruiters")}</Title>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setEditing(null)}
              >
                {t("agency.addRecruiter")}
              </Button>
            </Group>
            {recruiters.map((c) => (
              <ContactCard key={c.id} contact={c} onEdit={() => setEditing(c)} />
            ))}
            {!recruiters.length && (
              <Text size="sm" c="dimmed">
                {t("agency.noRecruiters")}
              </Text>
            )}
            <NotesCard entity={`agency:${agency.id}`} />
            <LinksCard entityType="agency" entityId={agency.id} />
            <AttachmentsCard entityType="agency" entityId={agency.id} />
          </Stack>
        </Grid.Col>
      </Grid>
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} />
      <ContactFormModal
        key={editing?.id ?? "new"}
        opened={editing !== undefined}
        contact={editing}
        defaultAgencyId={agency.id}
        onClose={() => setEditing(undefined)}
      />
    </Stack>
  );
}
