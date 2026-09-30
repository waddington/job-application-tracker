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
import { formatDate } from "../utils/time";

function iconFor(att: AttachmentItem) {
  const type = att.content_type ?? "";
  if (type === "application/pdf") return IconFileTypePdf;
  if (type.startsWith("image/")) return IconPhoto;
  if (type === "message/rfc822" || att.original_name.toLowerCase().endsWith(".eml")) return IconMail;
  if (type.startsWith("text/")) return IconTextCaption;
  return IconFile;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ att }: { att: AttachmentItem }) {
  const remove = useDeleteAttachment();
  const Icon = iconFor(att);
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Icon size={18} stroke={1.6} style={{ flexShrink: 0 }} />
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
            {att.original_name}
          </Anchor>
          <Text size="xs" c="dimmed">
            {humanSize(att.size)} · {formatDate(att.created_at.slice(0, 10))}
          </Text>
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
