import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";

import { shadow } from "../i18n/shadow";

/** Rename a company or agency and set its website. Mount it with a `key` so it starts fresh. */
export function EditNameModal({
  opened,
  onClose,
  title,
  name,
  website,
  saving,
  onSave,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  name: string;
  website: string | null;
  saving: boolean;
  onSave: (values: { name: string; website: string | null }) => void;
}) {
  const form = useForm({
    initialValues: { name, website: website ?? "" },
    validate: {
      name: (v) => (v.trim() ? null : shadow("common:editName.needsName", "It needs a name")),
      website: (v) =>
        !v.trim() || /^https?:\/\/[^\s/]+\.[^\s]+$/.test(v.trim())
          ? null
          : shadow("common:editName.websiteExample", "Like https://contoso.example.com"),
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={title}>
      <form
        onSubmit={form.onSubmit((v) => onSave({ name: v.name.trim(), website: v.website.trim() || null }))}
      >
        <Stack>
          <TextInput
            label={shadow("common:editName.name", "Name")}
            data-autofocus
            {...form.getInputProps("name")}
          />
          <TextInput
            label={shadow("common:editName.website", "Website")}
            placeholder={shadow("common:editName.websitePlaceholder", "https://…")}
            {...form.getInputProps("website")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {shadow("common:actions.cancel", "Cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {shadow("common:actions.save", "Save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
