import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Loader,
  Modal,
  SegmentedControl,
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

function AddVersionModal({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const { t } = useTranslation("documents");
  const add = useAddVersion(doc.id);
  const [file, setFile] = useState<File | null>(null);
  const form = useForm({
    initialValues: { label: t("newVersion.defaultLabel", { number: doc.versions.length + 1 }), notes: "" },
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
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={600}>
            {version.label}
          </Text>
          {version.used_in > 0 && (
            <Badge size="xs" variant="light">
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

function WhereUsed({ id }: { id: string }) {
  const { t } = useTranslation("documents");
  const { data } = useDocument(id);
  if (!data) return <Loader size="xs" />;
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
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconFileText size={20} stroke={1.6} />
            <Title order={4}>{doc.name}</Title>
            <Badge variant="light" color="gray">
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
        {doc.versions.map((v) => (
          <VersionRow key={v.id} version={v} />
        ))}
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
        {showUsage && <WhereUsed id={doc.id} />}
      </Stack>
      {adding && <AddVersionModal doc={doc} onClose={() => setAdding(false)} />}
    </Card>
  );
}

/** CVs and cover letters, with every version and where each was sent (PRD FR14). */
export function DocumentsPage() {
  const { t } = useTranslation("documents");
  const { data: documents, isLoading } = useDocuments();
  const [creating, setCreating] = useState(false);
  return (
    <Stack maw={900}>
      <Group justify="space-between">
        <Group gap="sm">
          <IconFileText size={26} stroke={1.6} />
          <Title order={2}>{t("page.title")}</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          {t("page.new")}
        </Button>
      </Group>
      <CvFilesCard />
      {isLoading || !documents ? (
        <Loader />
      ) : documents.length ? (
        documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
      ) : (
        <Card withBorder p="xl">
          <Text ta="center" c="dimmed">
            {t("page.empty")}
          </Text>
        </Card>
      )}
      {creating && <NewDocumentModal onClose={() => setCreating(false)} />}
    </Stack>
  );
}
