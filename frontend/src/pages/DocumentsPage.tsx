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
import { useState } from "react";

import {
  KIND_LABEL,
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
import { formatDate } from "../utils/time";

type Kind = "cv" | "cover_letter" | "other";

function NewDocumentModal({ onClose }: { onClose: () => void }) {
  const create = useCreateDocument();
  const form = useForm({
    initialValues: { kind: "cv" as Kind, name: "" },
    validate: { name: (v) => (v.trim() ? null : "Name it, e.g. Backend CV") },
  });
  return (
    <Modal opened onClose={onClose} title="New document">
      <form
        onSubmit={form.onSubmit((v) =>
          create.mutate({ kind: v.kind, name: v.name.trim() }, { onSuccess: onClose }),
        )}
      >
        <Stack>
          <SegmentedControl
            aria-label="Kind"
            data={[
              { value: "cv", label: "CV" },
              { value: "cover_letter", label: "Cover letter" },
              { value: "other", label: "Other" },
            ]}
            {...form.getInputProps("kind")}
          />
          <TextInput label="Name" placeholder="Backend CV" data-autofocus {...form.getInputProps("name")} />
          <Group justify="flex-end">
            <Button type="submit" loading={create.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function AddVersionModal({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const add = useAddVersion(doc.id);
  const [file, setFile] = useState<File | null>(null);
  const form = useForm({
    initialValues: { label: `v${doc.versions.length + 1}`, notes: "" },
    validate: { label: (v) => (v.trim() ? null : "Label it, e.g. v3 (fintech)") },
  });
  return (
    <Modal opened onClose={onClose} title={`New version of ${doc.name}`}>
      <form
        onSubmit={form.onSubmit((v) =>
          add.mutate({ label: v.label.trim(), notes: v.notes.trim(), file }, { onSuccess: onClose }),
        )}
      >
        <Stack>
          <TextInput label="Label" data-autofocus {...form.getInputProps("label")} />
          <TextInput
            label="What changed"
            placeholder="Leads with payments work"
            {...form.getInputProps("notes")}
          />
          <Group>
            <FileButton onChange={setFile} accept=".pdf,.doc,.docx,.odt,.md,.txt">
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={14} />}>
                  {file ? "Change file" : "Choose the file"}
                </Button>
              )}
            </FileButton>
            <Text size="sm" c="dimmed">
              {file ? `${file.name} (${humanSize(file.size)})` : "Optional, but handy"}
            </Text>
          </Group>
          <Group justify="flex-end">
            <Button type="submit" loading={add.isPending}>
              Add version
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function VersionRow({ version }: { version: DocumentVersion }) {
  const remove = useDeleteVersion();
  return (
    <Group justify="space-between" wrap="nowrap">
      <div style={{ minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={600}>
            {version.label}
          </Text>
          {version.used_in > 0 && (
            <Badge size="xs" variant="light">
              sent {version.used_in}×
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {formatDate(version.created_at.slice(0, 10))}
          {version.notes ? ` · ${version.notes}` : ""}
        </Text>
        {version.file && (
          <Anchor
            href={version.file.url}
            target={version.file.inline ? "_blank" : undefined}
            download={version.file.inline ? undefined : version.file.original_name}
            rel="noreferrer noopener"
            size="xs"
          >
            {version.file.original_name} ({humanSize(version.file.size)})
          </Anchor>
        )}
      </div>
      <Tooltip
        label={version.used_in ? "Sent with applications: remove it from them first" : "Delete version"}
      >
        <ActionIcon
          variant="subtle"
          color="gray"
          disabled={version.used_in > 0}
          loading={remove.isPending}
          onClick={() => window.confirm(`Delete ${version.label}?`) && remove.mutate(version.id)}
          aria-label={`Delete ${version.label}`}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function WhereUsed({ id }: { id: string }) {
  const { data } = useDocument(id);
  if (!data) return <Loader size="xs" />;
  if (!data.used_in.length) {
    return (
      <Text size="sm" c="dimmed">
        Not sent with any application yet.
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {data.used_in.map((u) => (
        <Text key={u.link_id} size="sm">
          <Anchor component={Link} to={`/applications/${u.application_id}`} size="sm">
            {u.company_name} · {u.role_title}
          </Anchor>{" "}
          <Text span size="xs" c="dimmed">
            {u.version_label}
            {u.sent_on ? ` · ${formatDate(u.sent_on)}` : ""} · {u.stage_name}
          </Text>
        </Text>
      ))}
    </Stack>
  );
}

function DocumentCard({ doc }: { doc: DocumentItem }) {
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
              {KIND_LABEL[doc.kind] ?? doc.kind}
            </Badge>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => setAdding(true)}
            >
              New version
            </Button>
            <Tooltip label={sent ? "Sent with applications: remove it from them first" : "Delete document"}>
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={sent > 0}
                onClick={() =>
                  window.confirm(`Delete ${doc.name} and all its versions?`) && remove.mutate(doc.id)
                }
                aria-label={`Delete ${doc.name}`}
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
            No versions yet. Add the file you send.
          </Text>
        )}
        <UnstyledButton onClick={() => setShowUsage((s) => !s)} aria-expanded={showUsage}>
          <Group gap={4}>
            <Chevron size={14} />
            <Text size="sm" fw={500}>
              Where it was used ({sent})
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
  const { data: documents, isLoading } = useDocuments();
  const [creating, setCreating] = useState(false);
  return (
    <Stack maw={900}>
      <Group justify="space-between">
        <Group gap="sm">
          <IconFileText size={26} stroke={1.6} />
          <Title order={2}>Documents</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          New document
        </Button>
      </Group>
      {isLoading || !documents ? (
        <Loader />
      ) : documents.length ? (
        documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
      ) : (
        <Card withBorder p="xl">
          <Text ta="center" c="dimmed">
            Add your CV and cover letters here, with a new version each time you tailor one. Then record which
            version you sent from each application.
          </Text>
        </Card>
      )}
      {creating && <NewDocumentModal onClose={() => setCreating(false)} />}
    </Stack>
  );
}
