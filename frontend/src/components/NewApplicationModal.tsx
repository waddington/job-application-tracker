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
import { useTranslation } from "react-i18next";

import {
  useAgencies,
  useCompanies,
  useContacts,
  useCreateApplication,
  useDuplicates,
  useWorkflow,
} from "../api/hooks";
import { stageName } from "../utils/stageName";
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

const WEB_LINK = /^https?:\/\//;

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
  const { t } = useTranslation(["applications", "common"]);

  const form = useForm<Values>({
    mode: "controlled",
    initialValues: EMPTY,
    validate: {
      company: (v) => (v.trim() ? null : t("new.errors.company")),
      roleTitle: (v) => (v.trim() ? null : t("new.errors.role")),
      roleUrl: (v) => (!v || WEB_LINK.test(v) ? null : t("new.errors.link")),
      agency: (v, values) =>
        values.route === "agency" && !v.trim() && !values.recruiter.trim() ? t("new.errors.agency") : null,
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
            title: t("new.added"),
            message: t("new.addedBody", { role: created.role_title, company: created.company_name }),
          });
          close(created.id);
        },
      },
    );
  });

  return (
    <Modal opened={opened} onClose={() => close()} title={t("new.title")} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm" c="dimmed">
            {t("new.intro")}
          </Text>
          <Group grow align="flex-start">
            <Autocomplete
              label={t("new.company")}
              placeholder={t("new.companyPlaceholder")}
              data={unique((companies ?? []).map((c) => c.name))}
              description={form.values.company.trim() && !company ? t("new.newCompany") : t("new.pickOrType")}
              data-autofocus
              {...form.getInputProps("company")}
            />
            <TextInput
              label={t("new.role")}
              placeholder={t("new.rolePlaceholder")}
              {...form.getInputProps("roleTitle")}
            />
          </Group>
          {showDuplicates && (
            <DuplicateWarning
              duplicates={duplicates}
              title={t("new.maybeApplied")}
              onNavigate={() => onClose()} // keep the draft: reopening the form picks up where you left off
            />
          )}
          <TextInput
            label={t("new.jobAd")}
            placeholder={t("new.jobAdPlaceholder")}
            {...form.getInputProps("roleUrl")}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t("new.how")}
            </Text>
            <SegmentedControl
              data={[
                { value: "direct", label: t("new.routes.direct") },
                { value: "agency", label: t("new.routes.agency") },
                { value: "referral", label: t("new.routes.referral") },
              ]}
              {...form.getInputProps("route")}
            />
          </div>
          {form.values.route === "direct" && (
            <Autocomplete
              label={t("new.whoReachedOut")}
              description={
                form.values.recruiter.trim() && !recruiterMatch
                  ? t("new.newPersonAtCompany")
                  : t("new.inHouseHint")
              }
              placeholder={t("new.personPlaceholder")}
              data={unique(peopleAtCompany.map((c) => c.name))}
              {...form.getInputProps("recruiter")}
            />
          )}
          {form.values.route === "agency" && (
            <Group grow align="flex-start">
              <Autocomplete
                label={t("new.agency")}
                placeholder={t("new.agencyPlaceholder")}
                data={unique((agencies ?? []).map((a) => a.name))}
                description={typedNewAgency ? t("new.newAgency") : t("new.pickOrType")}
                {...form.getInputProps("agency")}
              />
              <Autocomplete
                label={t("new.recruiter")}
                placeholder={t("new.recruiterPlaceholder")}
                data={unique(recruitersHere.map((c) => c.name))}
                description={
                  form.values.recruiter.trim() && !recruiterMatch ? t("new.newRecruiter") : t("new.optional")
                }
                {...form.getInputProps("recruiter")}
              />
            </Group>
          )}
          <Group grow align="flex-start">
            <Select
              label={t("new.stage")}
              data={(workflow?.stages ?? []).map((s) => ({ value: s.id, label: stageName(s) }))}
              allowDeselect={false}
              {...form.getInputProps("stage")}
            />
            <DateInput
              label={t("new.appliedOn")}
              placeholder={t("new.notYet")}
              clearable
              {...form.getInputProps("appliedOn")}
            />
          </Group>
          <TagsInput
            label={t("new.tags")}
            placeholder={t("new.tagsPlaceholder")}
            {...form.getInputProps("tags")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => close()}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t("new.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
