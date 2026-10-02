import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";

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
      name: (v) => (v.trim() ? null : "It needs a name"),
      website: (v) => (!v.trim() || /^https?:\/\//.test(v.trim()) ? null : "Websites start with https://"),
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={title}>
      <form
        onSubmit={form.onSubmit((v) => onSave({ name: v.name.trim(), website: v.website.trim() || null }))}
      >
        <Stack>
          <TextInput label="Name" data-autofocus {...form.getInputProps("name")} />
          <TextInput label="Website" placeholder="https://…" {...form.getInputProps("website")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
