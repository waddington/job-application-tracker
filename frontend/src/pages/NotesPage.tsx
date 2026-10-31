import { Button, Group, Loader, SegmentedControl, Stack, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconNotes, IconPlus, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotes } from "../api/noteHooks";
import { NoteEditorModal } from "../components/NoteEditorModal";
import { NotesList } from "../components/Notes";

/** Every note: general ones and those attached to applications, companies and people. */
export function NotesPage() {
  const { t } = useTranslation("notes");
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
          <Title order={2}>{t("page.title")}</Title>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          {t("page.new")}
        </Button>
      </Group>
      <Group>
        <TextInput
          placeholder={t("page.searchPlaceholder")}
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={320}
          aria-label={t("page.search")}
        />
        <SegmentedControl
          aria-label={t("page.which")}
          value={scope}
          onChange={(v) => setScope(v as "all" | "none")}
          data={[
            { value: "all", label: t("page.all") },
            { value: "none", label: t("page.general") },
          ]}
        />
      </Group>
      {isLoading || !notes ? (
        <Loader />
      ) : (
        <NotesList notes={notes} empty={debouncedQ.trim() ? t("page.noMatches") : t("page.none")} />
      )}
      {adding && <NoteEditorModal opened onClose={() => setAdding(false)} note={null} />}
    </Stack>
  );
}
