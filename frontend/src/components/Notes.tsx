import {
  ActionIcon,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteNote, useNote, useNotes, type Note, type NoteSummary } from "../api/noteHooks";
import { formatDateTime } from "../utils/time";
import { Markdown } from "./Markdown";
import { NoteEditorModal } from "./NoteEditorModal";
import { Pending } from "./QueryState";

/** A few lines of text while something loads: what the note's body or its list will be. */
const lines = (count: number) =>
  Array.from({ length: count }, (_, i) => <Skeleton key={i} height={20} radius="sm" />);

function NoteBody({ id }: { id: string }) {
  const { t } = useTranslation("notes");
  const query = useNote(id);
  const { data } = query;
  // Its text's first lines while it loads (the excerpt it replaces is two); the failed line with Retry.
  if (!data) return <Pending query={query} skeleton={lines(3)} />;
  return data.body.trim() ? (
    <Markdown>{data.body}</Markdown>
  ) : (
    <Text size="sm" c="dimmed">
      {t("item.empty")}
    </Text>
  );
}

function NoteItem({ note, onEdit }: { note: NoteSummary; onEdit: (id: string) => void }) {
  const { t } = useTranslation("notes");
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
          <Tooltip label={t("item.edit")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => onEdit(note.id)}
              aria-label={t("item.editNamed", { title: note.title })}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("item.delete")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(t("item.deleteConfirm", { title: note.title }))) remove.mutate(note.id);
              }}
              aria-label={t("item.deleteNamed", { title: note.title })}
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

/**
 * Opens the editor for an existing note once its full text has loaded. Text cached a while ago (or
 * from before a save elsewhere) is refetched first, so the form never starts from old words; once
 * open, it stays open whatever the query does next.
 */
function EditExisting({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isStale, isFetchedAfterMount } = useNote(id);
  const [ready, setReady] = useState(false);
  // A refetch that fails still opens it, from the cached text: the save's changed-since check covers that.
  if (!ready && data && (!isStale || isFetchedAfterMount)) setReady(true);
  if (!ready || !data) return null;
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
      {/* Keyed by the note, so another note's Edit starts over and waits for its own fresh text. */}
      {editing && <EditExisting key={editing} id={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

/** Notes attached to one thing (an application, company, agency…), for its page. */
export function NotesCard({ entity }: { entity: string }) {
  const { t } = useTranslation("notes");
  const query = useNotes({ entity });
  const notes = query.data;
  const [adding, setAdding] = useState(false);
  return (
    // A well: it holds a card per note.
    <Card withBorder variant="well">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>{t("card.title")}</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
          >
            {t("card.add")}
          </Button>
        </Group>
        {/* Most have none yet: the empty text's line while it loads. */}
        {notes ? (
          <NotesList notes={notes} empty={t("card.none")} />
        ) : (
          <Pending query={query} skeleton={lines(1)} />
        )}
      </Stack>
      {adding && (
        <NoteEditorModal opened onClose={() => setAdding(false)} note={null} defaultLinks={[entity]} />
      )}
    </Card>
  );
}
