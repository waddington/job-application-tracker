import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import { useDeleteNote, useNote, useNotes, type Note, type NoteSummary } from "../api/noteHooks";
import { formatDateTime } from "../utils/time";
import { Markdown } from "./Markdown";
import { NoteEditorModal } from "./NoteEditorModal";

function NoteBody({ id }: { id: string }) {
  const { data } = useNote(id);
  if (!data) return <Loader size="xs" />;
  return data.body.trim() ? (
    <Markdown>{data.body}</Markdown>
  ) : (
    <Text size="sm" c="dimmed">
      (empty)
    </Text>
  );
}

function NoteItem({ note, onEdit }: { note: NoteSummary; onEdit: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteNote();
  const Chevron = open ? IconChevronDown : IconChevronRight;
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <UnstyledButton
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Group gap={6} wrap="nowrap">
            <Chevron size={16} />
            <Text fw={600} truncate>
              {note.title}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" ml={22}>
            {formatDateTime(note.updated_at)}
          </Text>
          {!open && note.excerpt && (
            <Text size="sm" c="dimmed" ml={22} lineClamp={2}>
              {note.excerpt}
            </Text>
          )}
        </UnstyledButton>
        <Group gap={2} wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => onEdit(note.id)}
              aria-label={`Edit ${note.title}`}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="gray"
              loading={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(`Delete "${note.title}"? The file is removed too (it stays in git history).`)
                )
                  remove.mutate(note.id);
              }}
              aria-label={`Delete ${note.title}`}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      {open && (
        <Stack mt="xs" ml={22}>
          <NoteBody id={note.id} />
        </Stack>
      )}
    </Card>
  );
}

/** Opens the editor for an existing note once its full text has loaded. */
function EditExisting({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useNote(id);
  if (!data) return null;
  return <NoteEditorModal key={id} opened onClose={onClose} note={data as Note} />;
}

/** A list of notes, each expandable to its rendered Markdown, with edit and delete. */
export function NotesList({ notes, empty }: { notes: NoteSummary[]; empty: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Stack gap="xs">
      {notes.map((n) => (
        <NoteItem key={n.id} note={n} onEdit={setEditing} />
      ))}
      {!notes.length && (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      )}
      {editing && <EditExisting id={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

/** Notes attached to one thing (an application, company, agency…), for its page. */
export function NotesCard({ entity }: { entity: string }) {
  const { data: notes } = useNotes({ entity });
  const [adding, setAdding] = useState(false);
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>Notes</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
          >
            Add note
          </Button>
        </Group>
        {notes ? (
          <NotesList notes={notes} empty="No notes yet. Calls, prep, impressions: all in Markdown." />
        ) : (
          <Loader size="sm" />
        )}
      </Stack>
      {adding && (
        <NoteEditorModal opened onClose={() => setAdding(false)} note={null} defaultLinks={[entity]} />
      )}
    </Card>
  );
}
