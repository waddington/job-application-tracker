import { ActionIcon, Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect } from "react";

import type { Contact, Schemas } from "../api/client";
import { useSaveContact } from "../api/peopleHooks";
import { useAgencies, useCompanies } from "../api/hooks";

type Kind = Schemas["ContactDetailIn"]["kind"];

interface DetailRow {
  kind: Kind;
  label: string;
  value: string;
}

interface Values {
  name: string;
  title: string;
  agencyId: string | null;
  companyId: string | null;
  details: DetailRow[];
}

const KINDS: { value: Kind; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "url", label: "Link" },
  { value: "other", label: "Other" },
];

function fromContact(contact: Contact | null | undefined, agencyId: string | null): Values {
  return {
    name: contact?.name ?? "",
    title: contact?.title ?? "",
    agencyId: contact ? contact.agency_id : agencyId,
    companyId: contact?.company_id ?? null,
    details: contact?.details.map((d) => ({
      kind: d.kind as Kind,
      label: d.label ?? "",
      value: d.value,
    })) ?? [{ kind: "email", label: "", value: "" }],
  };
}

/** Create or edit a person: recruiter, hiring manager, interviewer… with any number of contact details. */
export function ContactFormModal({
  opened,
  onClose,
  contact,
  defaultAgencyId = null,
}: {
  opened: boolean;
  onClose: () => void;
  contact?: Contact | null;
  defaultAgencyId?: string | null;
}) {
  const { data: agencies } = useAgencies();
  const { data: companies } = useCompanies();
  const save = useSaveContact();
  const form = useForm<Values>({
    initialValues: fromContact(contact, defaultAgencyId),
    validate: {
      name: (v) => (v.trim() ? null : "Who is it?"),
      details: {
        value: (v, values, path) => {
          const index = Number(path.split(".")[1]);
          const kind = values.details[index]?.kind;
          if (!v.trim()) return null; // empty rows are dropped
          if (kind === "email" && !/^\S+@\S+\.\S+$/.test(v)) return "That doesn't look like an email address";
          if ((kind === "linkedin" || kind === "url") && !/^https?:\/\//.test(v))
            return "Links start with https://";
          return null;
        },
      },
    },
  });

  // Reload the form whenever a different contact (or a new one) is opened.
  useEffect(() => {
    if (!opened) return;
    const values = fromContact(contact, defaultAgencyId);
    form.setInitialValues(values);
    form.setValues(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, contact?.id, defaultAgencyId]);

  const submit = form.onSubmit((values) =>
    save.mutate(
      {
        id: contact?.id,
        body: {
          name: values.name.trim(),
          title: values.title.trim() || null,
          agency_id: values.agencyId,
          company_id: values.companyId,
          details: values.details
            .filter((d) => d.value.trim())
            .map((d) => ({ kind: d.kind, value: d.value.trim(), label: d.label.trim() || null })),
        },
      },
      { onSuccess: onClose },
    ),
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={contact ? `Edit ${contact.name}` : "New contact"}
      size="lg"
    >
      <form onSubmit={submit}>
        <Stack>
          <Group grow align="flex-start">
            <TextInput label="Name" data-autofocus {...form.getInputProps("name")} />
            <TextInput label="Job title" placeholder="Senior Consultant" {...form.getInputProps("title")} />
          </Group>
          <Group grow align="flex-start">
            <Select
              label="Agency"
              placeholder="None"
              clearable
              searchable
              data={(agencies ?? []).map((a) => ({ value: a.id, label: a.name }))}
              {...form.getInputProps("agencyId")}
            />
            <Select
              label="Company"
              description="For hiring managers and interviewers"
              placeholder="None"
              clearable
              searchable
              data={(companies ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...form.getInputProps("companyId")}
            />
          </Group>
          <Text size="sm" fw={500}>
            Contact details
          </Text>
          {form.values.details.map((_, index) => (
            <Group key={index} align="flex-start" wrap="nowrap">
              <Select
                data={KINDS}
                allowDeselect={false}
                w={130}
                aria-label="Kind"
                {...form.getInputProps(`details.${index}.kind`)}
              />
              <TextInput
                placeholder="Value"
                style={{ flex: 1 }}
                aria-label="Value"
                {...form.getInputProps(`details.${index}.value`)}
              />
              <TextInput
                placeholder="Label (work, mobile…)"
                w={170}
                aria-label="Label"
                {...form.getInputProps(`details.${index}.label`)}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                mt={6}
                aria-label="Remove detail"
                onClick={() => form.removeListItem("details", index)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="subtle"
            leftSection={<IconPlus size={14} />}
            onClick={() => form.insertListItem("details", { kind: "phone", label: "", value: "" })}
            w="fit-content"
          >
            Add a detail
          </Button>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {contact ? "Save" : "Add contact"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
