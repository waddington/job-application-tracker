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
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { useEffect } from "react";

import {
  useAgencies,
  useCompanies,
  useContacts,
  useCreateApplication,
  useDuplicates,
  useWorkflow,
} from "../api/hooks";
import { DuplicateWarning } from "./DuplicateWarning";

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

const EMPTY: Values = {
  company: "",
  roleTitle: "",
  roleUrl: "",
  route: "direct",
  agency: "",
  recruiter: "",
  stage: "",
  appliedOn: null,
  tags: [],
};

function findByName<T extends { name: string }>(items: T[] | undefined, name: string): T | undefined {
  const needle = name.trim().toLowerCase();
  return needle ? items?.find((i) => i.name.toLowerCase() === needle) : undefined;
}

const unique = (names: string[]) => [...new Set(names)];

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
    initialValues: EMPTY,
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

  // The workflow may arrive after the form mounts: default the stage once it does.
  const initialStage = workflow?.initial;
  useEffect(() => {
    if (!initialStage) return;
    form.setInitialValues({ ...EMPTY, stage: initialStage });
    if (!form.getValues().stage) form.setFieldValue("stage", initialStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStage]);

  const agency = findByName(agencies, form.values.agency);
  const typedNewAgency = form.values.agency.trim() && !agency;
  // Recruiters are matched within the chosen agency (the server does the same).
  const recruitersHere = (contacts ?? []).filter((c) =>
    agency ? c.agency_id === agency.id : !typedNewAgency,
  );
  const company = findByName(companies, form.values.company);
  // On a direct application, the "recruiter" is someone at the company (in-house).
  const peopleAtCompany = (contacts ?? []).filter(
    (c) => !c.agency_id && company && c.company_id === company.id,
  );
  const recruiterMatch = findByName(
    form.values.route === "direct" ? peopleAtCompany : recruitersHere,
    form.values.recruiter,
  );

  // Warn, while typing, about an application for the same job (PRD FR5). Never blocks saving.
  const [dupCompany] = useDebouncedValue(form.values.company, 300);
  const [dupTitle] = useDebouncedValue(form.values.roleTitle, 300);
  const dupCompanyId = findByName(companies, dupCompany)?.id;
  const { data: duplicates } = useDuplicates({
    companyId: dupCompanyId,
    companyName: dupCompany,
    roleTitle: dupTitle,
  });
  // Only while the results are for what's in the fields now, never a warning for older input.
  const settled =
    dupCompany.trim() === form.values.company.trim() && dupTitle.trim() === form.values.roleTitle.trim();
  const showDuplicates = !!(
    settled &&
    form.values.company.trim() &&
    form.values.roleTitle.trim() &&
    duplicates
  );

  const close = (id?: string) => {
    form.reset();
    onClose(id);
  };

  const submit = form.onSubmit((values) => {
    const viaAgency = values.route === "agency";
    const withRecruiter = viaAgency || values.route === "direct";
    create.mutate(
      {
        company_id: company?.id ?? null,
        company_name: company ? null : values.company.trim(),
        role_title: values.roleTitle.trim(),
        role_url: values.roleUrl || null,
        route: values.route,
        agency_id: viaAgency ? (agency?.id ?? null) : null,
        agency_name: viaAgency && !agency ? values.agency.trim() || null : null,
        recruiter_id: withRecruiter ? (recruiterMatch?.id ?? null) : null,
        recruiter_name: withRecruiter && !recruiterMatch ? values.recruiter.trim() || null : null,
        stage: values.stage || null,
        applied_on: values.appliedOn ? dayjs(values.appliedOn).format("YYYY-MM-DD") : null,
        tags: values.tags,
      },
      {
        onSuccess: (created) => {
          notifications.show({
            color: "teal",
            title: "Application added",
            message: `${created.role_title} at ${created.company_name}`,
          });
          close(created.id);
        },
      },
    );
  });

  return (
    <Modal opened={opened} onClose={() => close()} title="New application" size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm" c="dimmed">
            Type names as you go: a company, agency or person you haven't added yet is created for you.
          </Text>
          <Group grow align="flex-start">
            <Autocomplete
              label="Company"
              placeholder="Contoso"
              data={unique((companies ?? []).map((c) => c.name))}
              description={
                form.values.company.trim() && !company
                  ? "New company: it's added for you"
                  : "Pick one or type a new name"
              }
              data-autofocus
              {...form.getInputProps("company")}
            />
            <TextInput
              label="Role"
              placeholder="Senior Backend Engineer"
              {...form.getInputProps("roleTitle")}
            />
          </Group>
          {showDuplicates && (
            <DuplicateWarning
              duplicates={duplicates}
              title="You may have applied for this already"
              onNavigate={() => onClose()} // keep the draft: reopening the form picks up where you left off
            />
          )}
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
          {form.values.route === "direct" && (
            <Autocomplete
              label="Who reached out? (optional)"
              description={
                form.values.recruiter.trim() && !recruiterMatch
                  ? "New person at the company"
                  : "An in-house recruiter or head of talent, if they contacted you"
              }
              placeholder="Riley Chen"
              data={unique(peopleAtCompany.map((c) => c.name))}
              {...form.getInputProps("recruiter")}
            />
          )}
          {form.values.route === "agency" && (
            <Group grow align="flex-start">
              <Autocomplete
                label="Agency"
                placeholder="Northwind Talent"
                data={unique((agencies ?? []).map((a) => a.name))}
                description={
                  typedNewAgency ? "New agency: it's added for you" : "Pick one or type a new name"
                }
                {...form.getInputProps("agency")}
              />
              <Autocomplete
                label="Recruiter"
                placeholder="Alex Recruiter"
                data={unique(recruitersHere.map((c) => c.name))}
                description={
                  form.values.recruiter.trim() && !recruiterMatch
                    ? "New person: they're added for you"
                    : "Optional"
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
            <Button variant="default" onClick={() => close()}>
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
