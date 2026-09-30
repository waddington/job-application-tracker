import {
  Autocomplete,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";

import { useAgencies, useCompanies, useContacts, useCreateApplication, useWorkflow } from "../api/hooks";

interface Values {
  company: string;
  roleTitle: string;
  roleUrl: string;
  route: "direct" | "agency" | "referral";
  agency: string;
  recruiter: string;
  stage: string;
  appliedOn: string | null;
  tags: string[];
}

function findByName<T extends { id: string; name: string }>(
  items: T[] | undefined,
  name: string,
): T | undefined {
  const needle = name.trim().toLowerCase();
  return needle ? items?.find((i) => i.name.toLowerCase() === needle) : undefined;
}

export function NewApplicationModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: (id?: string) => void;
}) {
  const { data: workflow } = useWorkflow();
  const { data: companies } = useCompanies();
  const { data: agencies } = useAgencies();
  const { data: contacts } = useContacts();
  const create = useCreateApplication();

  const form = useForm<Values>({
    mode: "controlled",
    initialValues: {
      company: "",
      roleTitle: "",
      roleUrl: "",
      route: "direct",
      agency: "",
      recruiter: "",
      stage: workflow?.initial ?? "interested",
      appliedOn: null,
      tags: [],
    },
    validate: {
      company: (v) => (v.trim() ? null : "Which company?"),
      roleTitle: (v) => (v.trim() ? null : "What's the role?"),
      roleUrl: (v) => (!v || /^https?:\/\//.test(v) ? null : "Links start with http:// or https://"),
      agency: (v, values) =>
        values.route === "agency" && !v.trim() && !values.recruiter.trim()
          ? "Add the agency or recruiter"
          : null,
    },
  });

  const agency = findByName(agencies, form.values.agency);
  const recruiterOptions = (contacts ?? [])
    .filter((c) => !agency || c.agency_id === agency.id)
    .map((c) => c.name);
  const company = findByName(companies, form.values.company);

  const submit = form.onSubmit(async (values) => {
    const recruiter = findByName(contacts, values.recruiter);
    const created = await create.mutateAsync({
      companyId: company?.id ?? null,
      companyName: values.company,
      roleTitle: values.roleTitle,
      roleUrl: values.roleUrl || undefined,
      route: values.route,
      agencyId: agency?.id ?? (recruiter?.agency_id || null),
      agencyName: values.agency,
      recruiterId: recruiter?.id ?? null,
      recruiterName: values.recruiter,
      stage: values.stage,
      appliedOn: values.appliedOn ? dayjs(values.appliedOn).format("YYYY-MM-DD") : null,
      tags: values.tags,
    });
    notifications.show({
      color: "teal",
      title: "Application added",
      message: `${created.role_title} at ${created.company_name}`,
    });
    form.reset();
    onClose(created.id);
  });

  return (
    <Modal opened={opened} onClose={() => onClose()} title="New application" size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Group grow align="flex-start">
            <Autocomplete
              label="Company"
              placeholder="Contoso"
              data={(companies ?? []).map((c) => c.name)}
              description={form.values.company && !company ? "New company" : undefined}
              data-autofocus
              {...form.getInputProps("company")}
            />
            <TextInput
              label="Role"
              placeholder="Senior Backend Engineer"
              {...form.getInputProps("roleTitle")}
            />
          </Group>
          <TextInput label="Job ad link" placeholder="https://…" {...form.getInputProps("roleUrl")} />
          <div>
            <Text size="sm" fw={500} mb={4}>
              How did you apply?
            </Text>
            <SegmentedControl
              data={[
                { value: "direct", label: "Directly" },
                { value: "agency", label: "Through a recruiter" },
                { value: "referral", label: "Referral" },
              ]}
              {...form.getInputProps("route")}
            />
          </div>
          {form.values.route === "agency" && (
            <Group grow align="flex-start">
              <Autocomplete
                label="Agency"
                placeholder="Northwind Talent"
                data={(agencies ?? []).map((a) => a.name)}
                description={form.values.agency && !agency ? "New agency" : undefined}
                {...form.getInputProps("agency")}
              />
              <Autocomplete
                label="Recruiter"
                placeholder="Alex Recruiter"
                data={recruiterOptions}
                description={
                  form.values.recruiter && !findByName(contacts, form.values.recruiter)
                    ? "New contact"
                    : undefined
                }
                {...form.getInputProps("recruiter")}
              />
            </Group>
          )}
          <Group grow align="flex-start">
            <Select
              label="Stage"
              data={(workflow?.stages ?? []).map((s) => ({ value: s.id, label: s.name }))}
              allowDeselect={false}
              {...form.getInputProps("stage")}
            />
            <DateInput
              label="Applied on"
              placeholder="Not yet"
              clearable
              {...form.getInputProps("appliedOn")}
            />
          </Group>
          <TagsInput label="Tags" placeholder="python, fintech, remote…" {...form.getInputProps("tags")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => onClose()}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Add application
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
