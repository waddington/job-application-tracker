import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconBuilding, IconPlus, IconSearch } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useCreateCompany } from "../api/detailHooks";
import { useApplications, useCompanies } from "../api/hooks";
import { Page } from "../components/Page";
import { TableSkeleton } from "../components/PageSkeleton";
import { Pending } from "../components/QueryState";
import { SideScroll } from "../components/SideScroll";
import text from "../text.module.css";

const companyPath = (id: string) => `/companies/${id}`;
const WEB_LINK = /^https?:\/\//;

function NewCompanyModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation(["people", "common"]);
  const create = useCreateCompany();
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { name: "", website: "" },
    validate: {
      name: (v) => (v.trim() ? null : t("companies.nameIt")),
      website: (v) => (!v || WEB_LINK.test(v) ? null : t("places.linkStart")),
    },
  });
  // The dialog stays mounted while hidden, so clear what was typed whenever it closes.
  const close = () => {
    form.reset();
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title={t("companies.new")}>
      <form
        onSubmit={form.onSubmit((values) =>
          create.mutate(
            { name: values.name.trim(), website: values.website || null, description: null },
            {
              onSuccess: (company) => {
                close();
                void navigate({ to: `/companies/${company.id}` });
              },
            },
          ),
        )}
      >
        <Stack>
          <TextInput label={t("common:editName.name")} data-autofocus {...form.getInputProps("name")} />
          <TextInput
            label={t("common:editName.website")}
            placeholder={t("common:editName.websitePlaceholder")}
            {...form.getInputProps("website")}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={create.isPending}>
              {t("companies.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function CompaniesPage() {
  const { t } = useTranslation("people");
  const companiesQuery = useCompanies();
  const companies = companiesQuery.data;
  const { data: apps } = useApplications({});
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const stats = new Map<string, { total: number; active: number; stale: number }>();
  for (const a of apps ?? []) {
    const s = stats.get(a.company_id) ?? { total: 0, active: 0, stale: 0 };
    s.total += 1;
    if (a.stage_kind === "active") s.active += 1;
    if (a.stale) s.stale += 1;
    stats.set(a.company_id, s);
  }
  const shown = (companies ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Page>
      <Group justify="space-between">
        <Group gap="sm">
          <IconBuilding size={26} stroke={1.6} />
          <Title order={2}>{t("companies.title")}</Title>
          {companies && (
            <Badge variant="light" color="gray">
              {companies.length}
            </Badge>
          )}
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          {t("companies.new")}
        </Button>
      </Group>
      <TextInput
        placeholder={t("companies.search")}
        leftSection={<IconSearch size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        w={300}
        maw="100%"
        aria-label={t("companies.search")}
      />
      {companies === undefined ? (
        <Pending
          query={companiesQuery}
          skeleton={
            <Card padding="md">
              <TableSkeleton rows={8} rowHeight={47} headHeight={37} />
            </Card>
          }
        />
      ) : !shown.length ? (
        <Card withBorder p="xl">
          <Text ta="center" c="dimmed">
            {companies?.length ? t("companies.noMatch") : t("companies.none")}
          </Text>
        </Card>
      ) : (
        // On a soft card, as the Applications list is; on a phone the table scrolls sideways inside it.
        <Card padding="md">
          <SideScroll>
            <Table highlightOnHover verticalSpacing="sm" miw={560}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("companies.company")}</Table.Th>
                  <Table.Th className={text.keepWords}>{t("companies.applications")}</Table.Th>
                  <Table.Th className={text.keepWords}>{t("companies.inProgress")}</Table.Th>
                  <Table.Th>{t("companies.website")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((c) => {
                  const s = stats.get(c.id);
                  const open = () => void navigate({ to: companyPath(c.id) });
                  return (
                    <Table.Tr
                      key={c.id}
                      onClick={open}
                      onKeyDown={(e) => e.key === "Enter" && open()}
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      aria-label={t("companies.open", { name: c.name })}
                    >
                      <Table.Td fw={600}>{c.name}</Table.Td>
                      <Table.Td>{s?.total ?? 0}</Table.Td>
                      <Table.Td>
                        {s?.active ?? 0}
                        {s?.stale ? (
                          <Text span c="red" size="xs" ml={6} className={text.keepWords}>
                            {t("companies.toChase", { count: s.stale })}
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        {c.website && (
                          <Anchor
                            href={c.website}
                            target="_blank"
                            rel="noreferrer"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </Anchor>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </SideScroll>
        </Card>
      )}
      <NewCompanyModal opened={creating} onClose={() => setCreating(false)} />
      <Text size="xs" c="dimmed">
        <Trans
          t={t}
          i18nKey="companies.footer"
          components={{ apps: <Anchor component={Link} to="/applications" /> }}
        />
      </Text>
    </Page>
  );
}
