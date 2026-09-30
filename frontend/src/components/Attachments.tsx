import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  FileButton,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconFile,
  IconFileTypePdf,
  IconMail,
  IconPaperclip,
  IconPhoto,
  IconTextCaption,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useState, type DragEvent } from "react";

import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachments,
  type AttachmentItem,
} from "../api/attachmentHooks";
import { formatDate, formatDateTime } from "../utils/time";

/** An icon for the file's type. */
function AttachmentIcon({ att }: { att: AttachmentItem }) {
  const type = att.content_type ?? "";
  const props = { size: 18, stroke: 1.6, style: { flexShrink: 0 } };
  if (type === "application/pdf") return <IconFileTypePdf {...props} />;
  if (type.startsWith("image/")) return <IconPhoto {...props} />;
  if (type === "message/rfc822" || att.original_name.toLowerCase().endsWith(".eml"))
    return <IconMail {...props} />;
  if (type.startsWith("text/")) return <IconTextCaption {...props} />;
  return <IconFile {...props} />;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EmailMeta {
  email?: boolean;
  subject?: string;
  from?: string[];
  date?: string;
  snippet?: string;
}

function AttachmentRow({ att }: { att: AttachmentItem }) {
  const remove = useDeleteAttachment();
  // Exported emails show what they're about, not their file name.
  const mail = att.meta as EmailMeta;
  const title = mail.email ? mail.subject || "(no subject)" : att.original_name;
  const detail = mail.email
    ? [mail.from?.[0], mail.date ? formatDateTime(mail.date) : null, humanSize(att.size)]
        .filter(Boolean)
        .join(" · ")
    : `${humanSize(att.size)} · ${formatDate(att.created_at.slice(0, 10))}`;
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <AttachmentIcon att={att} />
        <div style={{ minWidth: 0 }}>
          <Anchor
            href={att.url}
            // PDFs and images open in a tab; anything else downloads.
            target={att.inline ? "_blank" : undefined}
            rel="noreferrer noopener"
            download={att.inline ? undefined : att.original_name}
            size="sm"
            fw={500}
            truncate="end"
            display="block"
          >
            {title}
          </Anchor>
          <Text size="xs" c="dimmed" truncate="end">
            {detail}
          </Text>
          {mail.snippet && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {mail.snippet}
            </Text>
          )}
        </div>
      </Group>
      <Tooltip label="Delete file">
        <ActionIcon
          variant="subtle"
          color="gray"
          loading={remove.isPending}
          onClick={() => {
            if (window.confirm(`Delete ${att.original_name}? (It stays in your data repo's git history.)`))
              remove.mutate(att.id);
          }}
          aria-label={`Delete ${att.original_name}`}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/** Files on one thing: CVs sent, briefs, screenshots, exported emails. Drop files on the card to add them. */
export function AttachmentsCard({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: files } = useAttachments(entityType, entityId);
  const upload = useUploadAttachments(entityType, entityId);
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) upload.mutate(dropped);
  };

  return (
    <Card
      withBorder
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        // Moving over a child fires dragleave too: only stop when the pointer leaves the card.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      style={dragging ? { outline: "2px dashed var(--mantine-color-blue-5)", outlineOffset: -4 } : undefined}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap={6}>
            <IconPaperclip size={18} />
            <Title order={4}>Files</Title>
          </Group>
          <FileButton onChange={(picked) => picked.length && upload.mutate(picked)} multiple>
            {(props) => (
              <Button
                {...props}
                size="xs"
                variant="light"
                leftSection={<IconUpload size={14} />}
                loading={upload.isPending}
              >
                Upload
              </Button>
            )}
          </FileButton>
        </Group>
        {(files ?? []).map((att) => (
          <AttachmentRow key={att.id} att={att} />
        ))}
        {files && !files.length && (
          <Text size="sm" c="dimmed">
            Drop files here: the CV you sent, a brief, an exported email. Up to 50 MB each, kept in your data
            folder.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
