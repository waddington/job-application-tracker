import { Button, Group, Modal, MultiSelect, Stack, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";

import { useAgencies, useApplications, useCompanies, useContacts } from "../api/hooks";
import { useSaveNote, type Note } from "../api/noteHooks";
import { Markdown } from "./Markdown";

interface Values {
  title: string;
  body: string;
  links: string[];
}

/** Everything a note can be attached to, grouped for a MultiSelect ("application:<id>" etc.). */
function useLinkOptions() {
  const { t } = useTranslation("notes");
  const { data: apps } = useApplications({});
  const { data: companies } = useCompanies();
  const { data: agencies } = useAgencies();
  const { data: contacts } = useContacts();
  return [
    {
      group: t("editor.groups.applications"),
      items: (apps ?? []).map((a) => ({
        value: `application:${a.id}`,
        label: t("editor.application", { company: a.company_name, role: a.role_title }),
      })),
    },
    {
      group: t("editor.groups.companies"),
      items: (companies ?? []).map((c) => ({ value: `company:${c.id}`, label: c.name })),
    },
    {
      group: t("editor.groups.agencies"),
      items: (agencies ?? []).map((a) => ({ value: `agency:${a.id}`, label: a.name })),
    },
    {
      group: t("editor.groups.people"),
      items: (contacts ?? []).map((c) => ({ value: `contact:${c.id}`, label: c.name })),
    },
  ].filter((g) => g.items.length);
}

/**
 * Write or edit a Markdown note. `links` starts with whatever the note is being added to;
 * a note with no links is a general note. Mount it with a `key` so each note starts fresh.
 */
export function NoteEditorModal({
  opened,
  onClose,
  note,
  defaultLinks = [],
}: {
  opened: boolean;
  onClose: () => void;
  note: Note | null;
  defaultLinks?: string[];
}) {
  const { t } = useTranslation(["notes", "common"]);
  const save = useSaveNote();
  const options = useLinkOptions();
  const form = useForm<Values>({
    initialValues: { title: note?.title ?? "", body: note?.body ?? "", links: note?.links ?? defaultLinks },
    validate: { title: (v) => (v.trim() ? null : t("editor.titleError")) },
  });
  // Keep links the pickers don't know about (e.g. a role or interview), so saving never drops them.
  const known = new Set(options.flatMap((g) => g.items.map((i) => i.value)));
  const hidden = form.values.links.filter((l) => !known.has(l));

  const submit = form.onSubmit((v) =>
    save.mutate(
      {
        id: note?.id,
        body: { title: v.title.trim(), body: v.body, links: v.links },
        // Refused (409) if the note changed since it was opened, e.g. in an outside editor.
        baseUpdatedAt: note?.updated_at,
      },
      { onSuccess: onClose },
    ),
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={note ? t("editor.editTitle") : t("editor.newTitle")}
      size="xl"
    >
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label={t("editor.title")}
            placeholder={t("editor.titlePlaceholder")}
            data-autofocus
            {...form.getInputProps("title")}
          />
          <Tabs defaultValue="write" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="write">{t("editor.write")}</Tabs.Tab>
              <Tabs.Tab value="preview">{t("editor.preview")}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="write" pt="xs">
              <Textarea
                aria-label={t("editor.note")}
                placeholder={t("editor.notePlaceholder")}
                autosize
                minRows={8}
                maxRows={24}
                styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
                {...form.getInputProps("body")}
              />
            </Tabs.Panel>
            <Tabs.Panel value="preview" pt="xs">
              {form.values.body.trim() ? (
                <Markdown>{form.values.body}</Markdown>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("editor.nothingToPreview")}
                </Text>
              )}
            </Tabs.Panel>
          </Tabs>
          <MultiSelect
            label={t("editor.attachedTo")}
            description={t("editor.attachedHint")}
            placeholder={t("editor.attachedPlaceholder")}
            searchable
            clearable
            data={options}
            value={form.values.links.filter((l) => known.has(l))}
            onChange={(picked) => form.setFieldValue("links", [...picked, ...hidden])}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {note ? t("common:actions.save") : t("editor.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
