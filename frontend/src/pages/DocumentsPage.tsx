import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  FileButton,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileText,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CvFilesCard } from "../components/CvFiles";
import {
  documentKind,
  useAddVersion,
  useCreateDocument,
  useDeleteDocument,
  useDeleteVersion,
  useDocument,
  useDocuments,
  type DocumentItem,
  type DocumentVersion,
} from "../api/documentHooks";
import { humanSize } from "../components/Attachments";
import { Page, READING_WIDTH } from "../components/Page";
import { CardsSkeleton } from "../components/PageSkeleton";
import { Pending } from "../components/QueryState";
import { stageName } from "../utils/stageName";
import { formatDate } from "../utils/time";

type Kind = "cv" | "cover_letter" | "other";

function NewDocumentModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("documents");
  const create = useCreateDocument();
  const form = useForm({
    initialValues: { kind: "cv" as Kind, name: "" },
    validate: { name: (v) => (v.trim() ? null : t("newDocument.nameError")) },
  });
  return (
    <Modal opened onClose={onClose} title={t("newDocument.title")}>
      <form
        onSubmit={form.onSubmit((v) =>
          create.mutate({ kind: v.kind, name: v.name.trim() }, { onSuccess: onClose }),
        )}
      >
        <Stack>
          <SegmentedControl
            aria-label={t("newDocument.kind")}
            data={[
              { value: "cv", label: t("kinds.cv") },
              { value: "cover_letter", label: t("kinds.cover_letter") },
              { value: "other", label: t("kinds.other") },
            ]}
            {...form.getInputProps("kind")}
          />
          <TextInput
            label={t("newDocument.name")}
            placeholder={t("newDocument.namePlaceholder")}
            data-autofocus
            {...form.getInputProps("name")}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={create.isPending}>
              {t("newDocument.create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** One above the highest "vN" label ("v3 (fintech)" counts as 3), so the suggestion never repeats one. */
function nextVersionNumber(labels: string[]): number {
  const numbers = labels.map((label) => /^v(\d+)(?:\s|$)/i.exec(label.trim())?.[1]).map(Number);
  // A number too big to add one to exactly ("v99999999999999999999") is ignored, like a label that isn't vN.
  return Math.max(0, ...numbers.filter((n) => Number.isSafeInteger(n) && n < Number.MAX_SAFE_INTEGER)) + 1;
}

function AddVersionModal({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const { t } = useTranslation("documents");
  const add = useAddVersion(doc.id);
  const [file, setFile] = useState<File | null>(null);
  const number = nextVersionNumber(doc.versions.map((v) => v.label));
  const form = useForm({
    initialValues: { label: t("newVersion.defaultLabel", { number }), notes: "" },
    validate: { label: (v) => (v.trim() ? null : t("newVersion.labelError")) },
  });
  return (
    <Modal opened onClose={onClose} title={t("newVersion.title", { name: doc.name })}>
      <form
        onSubmit={form.onSubmit((v) =>
          add.mutate({ label: v.label.trim(), notes: v.notes.trim(), file }, { onSuccess: onClose }),
        )}
      >
        <Stack>
          <TextInput label={t("newVersion.label")} data-autofocus {...form.getInputProps("label")} />
          <TextInput
            label={t("newVersion.changed")}
            placeholder={t("newVersion.changedPlaceholder")}
            {...form.getInputProps("notes")}
          />
          <Group>
            <FileButton onChange={setFile} accept=".pdf,.doc,.docx,.odt,.md,.txt">
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={14} />}>
                  {file ? t("newVersion.changeFile") : t("newVersion.chooseFile")}
                </Button>
              )}
            </FileButton>
            <Text size="sm" c="dimmed">
              {file
                ? t("newVersion.file", { name: file.name, size: humanSize(file.size) })
                : t("newVersion.fileOptional")}
            </Text>
          </Group>
          <Group justify="flex-end">
            <Button type="submit" loading={add.isPending}>
              {t("newVersion.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function VersionRow({ version }: { version: DocumentVersion }) {
  const { t } = useTranslation("documents");
  const remove = useDeleteVersion();
  const date = formatDate(dayjs(version.created_at).format("YYYY-MM-DD"));
  return (
    <Group justify="space-between" wrap="nowrap">
      <div style={{ minWidth: 0 }}>
        <Group gap={6}>
          <Text size="sm" fw={600}>
            {version.label}
          </Text>
          {version.used_in > 0 && (
            <Badge size="xs" variant="light" miw="max-content">
              {t("version.sentTimes", { times: version.used_in })}
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {version.notes ? t("version.dateNotes", { date, notes: version.notes }) : date}
        </Text>
        {version.file && (
          <Anchor
            href={version.file.url}
            target={version.file.inline ? "_blank" : undefined}
            download={version.file.inline ? undefined : version.file.original_name}
            rel="noreferrer noopener"
            size="xs"
          >
            {t("version.file", { name: version.file.original_name, size: humanSize(version.file.size) })}
          </Anchor>
        )}
      </div>
      <Tooltip label={version.used_in ? t("version.sentBlocks") : t("version.delete")}>
        <ActionIcon
          variant="subtle"
          color="gray"
          disabled={version.used_in > 0}
          loading={remove.isPending}
          onClick={() =>
            window.confirm(t("version.deleteConfirm", { label: version.label })) && remove.mutate(version.id)
          }
          aria-label={t("version.deleteNamed", { label: version.label })}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function WhereUsed({ id, sent }: { id: string; sent: number }) {
  const { t } = useTranslation("documents");
  const query = useDocument(id);
  const { data } = query;
  // A line per application it went to (the button's count), or the line for none; the failed line with Retry.
  if (!data)
    return (
      <Pending
        query={query}
        skeleton={
          <Stack gap={4}>
            {Array.from({ length: Math.max(sent, 1) }, (_, i) => (
              <Skeleton key={i} height={22} radius="sm" />
            ))}
          </Stack>
        }
      />
    );
  if (!data.used_in.length) {
    return (
      <Text size="sm" c="dimmed">
        {t("used.none")}
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {data.used_in.map((u) => (
        <Text key={u.link_id} size="sm">
          <Anchor component={Link} to={`/applications/${u.application_id}`} size="sm">
            {t("used.application", { company: u.company_name, role: u.role_title })}
          </Anchor>{" "}
          <Text span size="xs" c="dimmed">
            {u.sent_on
              ? t("used.versionDateStage", {
                  version: u.version_label,
                  date: formatDate(u.sent_on),
                  stage: stageName({ id: u.stage, name: u.stage_name }),
                })
              : t("used.versionStage", {
                  version: u.version_label,
                  stage: stageName({ id: u.stage, name: u.stage_name }),
                })}
          </Text>
        </Text>
      ))}
    </Stack>
  );
}

function DocumentCard({ doc }: { doc: DocumentItem }) {
  const { t } = useTranslation("documents");
  const [adding, setAdding] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const remove = useDeleteDocument();
  const sent = doc.versions.reduce((n, v) => n + v.used_in, 0);
  const Chevron = showUsage ? IconChevronDown : IconChevronRight;
  return (
    <Card withBorder>
      <Stack gap="sm">
        {/* In a narrow card its buttons go under the name rather than squeezing it. */}
        <Group justify="space-between" align="flex-start" gap="xs">
          <Group gap="xs">
            <IconFileText size={20} stroke={1.6} />
            <Title order={4}>{doc.name}</Title>
            <Badge variant="light" color="gray" miw="max-content">
              {documentKind(doc.kind)}
            </Badge>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => setAdding(true)}
            >
              {t("card.newVersion")}
            </Button>
            <Tooltip label={sent ? t("card.sentBlocks") : t("card.delete")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={sent > 0}
                onClick={() =>
                  window.confirm(t("card.deleteConfirm", { name: doc.name })) && remove.mutate(doc.id)
                }
                aria-label={t("card.deleteNamed", { name: doc.name })}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        {doc.versions.length > 0 && (
          <Stack gap="sm" maw={READING_WIDTH}>
            {doc.versions.map((v) => (
              <VersionRow key={v.id} version={v} />
            ))}
          </Stack>
        )}
        {!doc.versions.length && (
          <Text size="sm" c="dimmed">
            {t("card.noVersions")}
          </Text>
        )}
        <UnstyledButton onClick={() => setShowUsage((s) => !s)} aria-expanded={showUsage}>
          <Group gap={4}>
            <Chevron size={14} />
            <Text size="sm" fw={500}>
              {t("card.whereUsed", { sent })}
            </Text>
          </Group>
        </UnstyledButton>
        {showUsage && <WhereUsed id={doc.id} sent={sent} />}
      </Stack>
      {adding && <AddVersionModal doc={doc} onClose={() => setAdding(false)} />}
    </Card>
  );
}

/**
 * The CV files waiting to be sorted and each document as cards side by side (docs/rfc/app-redesign.md §2, Pages),
 * laid out by the page's own width: a column for about every 520 px up to four, so 2 at a 1,440 px window, 3 at
 * 1,920 and 4 at 2,560. Each card keeps its own height and a row's cards start level.
 */
const DOCUMENT_COLUMNS = { base: 1, "1000px": 2, "1560px": 3, "2100px": 4 };

/** CVs and cover letters, with every version and where each was sent (PRD FR14). */
export function DocumentsPage() {
  const { t } = useTranslation("documents");
  const query = useDocuments();
  const documents = query.data;
  const [creating, setCreating] = useState(false);
  return (
    <Page>
      <Group justify="space-between">
        <Group gap="sm">
          <IconFileText size={26} stroke={1.6} />
          <Title order={2}>{t("page.title")}</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          {t("page.new")}
        </Button>
      </Group>
      <SimpleGrid
        type="container"
        cols={DOCUMENT_COLUMNS}
        style={{ alignItems: "start" }}
        data-documents-grid
      >
        <CvFilesCard />
        {documents === undefined ? (
          <Box style={{ gridColumn: "1 / -1" }}>
            <Pending
              query={query}
              skeleton={<CardsSkeleton count={3} height={160} cols={DOCUMENT_COLUMNS} type="container" />}
            />
          </Box>
        ) : documents.length ? (
          documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
        ) : (
          <Card withBorder p="xl" style={{ gridColumn: "1 / -1" }}>
            <Text ta="center" c="dimmed">
              {t("page.empty")}
            </Text>
          </Card>
        )}
      </SimpleGrid>
      {creating && <NewDocumentModal onClose={() => setCreating(false)} />}
    </Page>
  );
}
