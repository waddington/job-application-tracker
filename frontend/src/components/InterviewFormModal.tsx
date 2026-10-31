import {
  Autocomplete,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { useContacts } from "../api/hooks";
import {
  KIND_OPTIONS,
  useInterviewTitles,
  useSaveInterview,
  type Interview,
  type InterviewKind,
} from "../api/interviewHooks";
import { i18n } from "../i18n";
import { roundLabel } from "../utils/rounds";

type Status = "scheduled" | "done" | "cancelled";
type Format = "video" | "phone" | "onsite" | "take_home";

interface Values {
  round: number | string;
  title: string;
  kind: NonNullable<InterviewKind>;
  status: Status;
  startsAt: string | null;
  deadlineAt: string | null;
  format: Format | null;
  location: string;
  meetingUrl: string;
  interviewerIds: string[];
  prep: string;
  debrief: string;
  questions: string;
  taskInstructions: string;
  taskRepoUrl: string;
}

const PICKER = "YYYY-MM-DD HH:mm:ss";
const toPicker = (iso: string | null | undefined) => (iso ? dayjs(iso).format(PICKER) : null);
const toIso = (local: string | null) => (local ? dayjs(local).toISOString() : null);
const blank = (s: string) => s.trim() || null;
const LINK = /^https?:\/\//;

function fromInterview(interview: Interview | null, nextRound: number): Values {
  return {
    round: interview?.round ?? nextRound,
    title: interview?.title ?? "",
    kind: (interview?.kind as Values["kind"]) ?? "technical",
    status: (interview?.status as Status) ?? "scheduled",
    startsAt: toPicker(interview?.starts_at),
    deadlineAt: toPicker(interview?.deadline_at),
    format: (interview?.format as Format | null) ?? null,
    location: interview?.location ?? "",
    meetingUrl: interview?.meeting_url ?? "",
    interviewerIds: interview?.interviewer_ids ?? [],
    prep: interview?.prep ?? "",
    debrief: interview?.debrief ?? "",
    questions: interview?.questions ?? "",
    taskInstructions: interview?.task_instructions ?? "",
    taskRepoUrl: interview?.task_repo_url ?? "",
  };
}

/**
 * Add or edit an interview round: which round it is, what it is in your own words
 * ("Engineering manager chat"), when, who with, and prep and debrief notes.
 * Mount it with a `key` per interview so the form starts fresh for each.
 */
export function InterviewFormModal({
  opened,
  onClose,
  applicationId,
  interview,
  nextRound,
}: {
  opened: boolean;
  onClose: () => void;
  applicationId: string;
  interview: Interview | null;
  nextRound: number;
}) {
  const { t } = useTranslation(["interviews", "common"]);
  const { data: titles } = useInterviewTitles();
  const { data: contacts } = useContacts();
  const save = useSaveInterview();
  const isLink = (v: string) => (!v || LINK.test(v) ? null : t("form.linkError"));
  const form = useForm<Values>({
    initialValues: fromInterview(interview, nextRound),
    validate: {
      round: (v) => (Number(v) >= 1 && Number(v) <= 99 ? null : t("form.roundError")),
      meetingUrl: isLink,
      taskRepoUrl: isLink,
    },
  });
  const isTask = form.values.kind === "coding_task" || form.values.format === "take_home";

  const submit = form.onSubmit((v) => {
    const body = {
      round: Number(v.round),
      title: blank(v.title),
      kind: v.kind,
      status: v.status,
      starts_at: toIso(v.startsAt),
      deadline_at: isTask ? toIso(v.deadlineAt) : null, // only tasks have a due date
      format: v.format,
      location: blank(v.location),
      meeting_url: blank(v.meetingUrl),
      interviewer_ids: v.interviewerIds,
      prep: blank(v.prep),
      debrief: blank(v.debrief),
      questions: blank(v.questions),
      task_instructions: blank(v.taskInstructions),
      task_repo_url: blank(v.taskRepoUrl),
    };
    save.mutate(interview ? { id: interview.id, body } : { applicationId, body }, { onSuccess: onClose });
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={interview ? t("form.editTitle", { label: roundLabel(interview) }) : t("form.addTitle")}
      size="lg"
    >
      <form onSubmit={submit}>
        <Stack>
          <Group align="flex-start" wrap="nowrap">
            <NumberInput label={t("form.round")} min={1} max={99} w={90} {...form.getInputProps("round")} />
            <Autocomplete
              label={t("form.what")}
              placeholder={t("form.whatPlaceholder")}
              data={titles ?? []}
              style={{ flex: 1 }}
              data-autofocus
              {...form.getInputProps("title")}
            />
          </Group>
          <Group grow align="flex-start">
            <Select
              label={t("form.type")}
              data={KIND_OPTIONS.map((k) => ({ value: k.value, label: i18n.t(k.key) }))}
              allowDeselect={false}
              {...form.getInputProps("kind")}
            />
            <Select
              label={t("form.format")}
              placeholder={t("form.formatPlaceholder")}
              clearable
              data={[
                { value: "video", label: t("form.formats.video") },
                { value: "phone", label: t("form.formats.phone") },
                { value: "onsite", label: t("form.formats.onsite") },
                { value: "take_home", label: t("form.formats.take_home") },
              ]}
              {...form.getInputProps("format")}
            />
          </Group>
          <SegmentedControl
            aria-label={t("form.status")}
            data={[
              { value: "scheduled", label: t("status.comingUp") },
              { value: "done", label: t("status.done") },
              { value: "cancelled", label: t("status.cancelled") },
            ]}
            {...form.getInputProps("status")}
          />
          <Group grow align="flex-start">
            <DateTimePicker
              label={t("form.when")}
              placeholder={t("form.whenPlaceholder")}
              clearable
              {...form.getInputProps("startsAt")}
            />
            {isTask && (
              <DateTimePicker
                label={t("form.due")}
                placeholder={t("form.duePlaceholder")}
                clearable
                {...form.getInputProps("deadlineAt")}
              />
            )}
          </Group>
          <Group grow align="flex-start">
            <TextInput
              label={t("form.meetingLink")}
              placeholder={t("form.linkPlaceholder")}
              {...form.getInputProps("meetingUrl")}
            />
            <TextInput
              label={t("form.location")}
              placeholder={t("form.locationPlaceholder")}
              {...form.getInputProps("location")}
            />
          </Group>
          <MultiSelect
            label={t("form.interviewers")}
            placeholder={t("form.interviewersPlaceholder")}
            searchable
            data={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
            {...form.getInputProps("interviewerIds")}
          />
          {isTask && (
            <>
              <Textarea
                label={t("form.taskInstructions")}
                autosize
                minRows={2}
                {...form.getInputProps("taskInstructions")}
              />
              <TextInput
                label={t("form.repoLink")}
                placeholder={t("form.linkPlaceholder")}
                {...form.getInputProps("taskRepoUrl")}
              />
            </>
          )}
          <Textarea
            label={t("form.prep")}
            placeholder={t("form.prepPlaceholder")}
            autosize
            minRows={2}
            {...form.getInputProps("prep")}
          />
          <Textarea
            label={t("form.debrief")}
            placeholder={t("form.debriefPlaceholder")}
            autosize
            minRows={2}
            {...form.getInputProps("debrief")}
          />
          <Textarea label={t("form.questions")} autosize minRows={2} {...form.getInputProps("questions")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {interview ? t("common:actions.save") : t("form.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
