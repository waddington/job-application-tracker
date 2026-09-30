import { Button, Group, Loader, SegmentedControl, Stack, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconNotes, IconPlus, IconSearch } from "@tabler/icons-react";
import { useState } from "react";

import { useNotes } from "../api/noteHooks";
import { NoteEditorModal } from "../components/NoteEditorModal";
import { NotesList } from "../components/Notes";

/** Every note: general ones and those attached to applications, companies and people. */
export function NotesPage() {
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q, 250);
  const [scope, setScope] = useState<"all" | "none">("all");
  const [adding, setAdding] = useState(false);
  const { data: notes, isLoading } = useNotes({
    q: debouncedQ.trim(),
    entity: scope === "none" ? "none" : undefined,
  });

  return (
    <Stack maw={900}>
      <Group justify="space-between">
        <Group gap="sm">
          <IconNotes size={26} stroke={1.6} />
          <Title order={2}>Notes</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          New note
        </Button>
      </Group>
      <Group>
        <TextInput
          placeholder="Search titles and text"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={320}
          aria-label="Search notes"
        />
        <SegmentedControl
          aria-label="Which notes"
          value={scope}
          onChange={(v) => setScope(v as "all" | "none")}
          data={[
            { value: "all", label: "All notes" },
            { value: "none", label: "General only" },
          ]}
        />
      </Group>
      {isLoading || !notes ? (
        <Loader />
      ) : (
        <NotesList
          notes={notes}
          empty={
            debouncedQ.trim()
              ? "No matches."
              : "No notes yet. Notes are Markdown files in your data folder's notes/ directory."
          }
        />
      )}
      {adding && <NoteEditorModal opened onClose={() => setAdding(false)} note={null} />}
    </Stack>
  );
}
