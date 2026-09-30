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

import { useContacts } from "../api/hooks";
import {
  KIND_OPTIONS,
  useInterviewTitles,
  useSaveInterview,
  type Interview,
  type InterviewKind,
} from "../api/interviewHooks";

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
const isLink = (v: string) => (!v || /^https?:\/\//.test(v) ? null : "Links start with http:// or https://");

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
  const { data: titles } = useInterviewTitles();
  const { data: contacts } = useContacts();
  const save = useSaveInterview();
  const form = useForm<Values>({
    initialValues: fromInterview(interview, nextRound),
    validate: {
      round: (v) => (Number(v) >= 1 && Number(v) <= 99 ? null : "Rounds go from 1 to 99"),
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
      deadline_at: toIso(v.deadlineAt),
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
      title={interview ? `Edit ${interview.label}` : "Add an interview round"}
      size="lg"
    >
      <form onSubmit={submit}>
        <Stack>
          <Group align="flex-start" wrap="nowrap">
            <NumberInput label="Round" min={1} max={99} w={90} {...form.getInputProps("round")} />
            <Autocomplete
              label="What is it?"
              placeholder="Engineering manager chat, System design test…"
              data={titles ?? []}
              style={{ flex: 1 }}
              data-autofocus
              {...form.getInputProps("title")}
            />
          </Group>
          <Group grow align="flex-start">
            <Select label="Type" data={KIND_OPTIONS} allowDeselect={false} {...form.getInputProps("kind")} />
            <Select
              label="Format"
              placeholder="Not set"
              clearable
              data={[
                { value: "video", label: "Video call" },
                { value: "phone", label: "Phone" },
                { value: "onsite", label: "In person" },
                { value: "take_home", label: "Take-home" },
              ]}
              {...form.getInputProps("format")}
            />
          </Group>
          <SegmentedControl
            data={[
              { value: "scheduled", label: "Coming up" },
              { value: "done", label: "Done" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            {...form.getInputProps("status")}
          />
          <Group grow align="flex-start">
            <DateTimePicker
              label="When"
              placeholder="Not booked yet"
              clearable
              {...form.getInputProps("startsAt")}
            />
            {isTask && (
              <DateTimePicker
                label="Due"
                placeholder="No deadline"
                clearable
                {...form.getInputProps("deadlineAt")}
              />
            )}
          </Group>
          <Group grow align="flex-start">
            <TextInput label="Meeting link" placeholder="https://…" {...form.getInputProps("meetingUrl")} />
            <TextInput label="Location" placeholder="Office, floor 3" {...form.getInputProps("location")} />
          </Group>
          <MultiSelect
            label="Interviewers"
            placeholder="Pick people"
            searchable
            data={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
            {...form.getInputProps("interviewerIds")}
          />
          {isTask && (
            <>
              <Textarea
                label="Task instructions"
                autosize
                minRows={2}
                {...form.getInputProps("taskInstructions")}
              />
              <TextInput
                label="Repo or platform link"
                placeholder="https://…"
                {...form.getInputProps("taskRepoUrl")}
              />
            </>
          )}
          <Textarea
            label="Prep"
            placeholder="What to read up on"
            autosize
            minRows={2}
            {...form.getInputProps("prep")}
          />
          <Textarea
            label="Debrief"
            placeholder="How it went"
            autosize
            minRows={2}
            {...form.getInputProps("debrief")}
          />
          <Textarea label="Questions asked" autosize minRows={2} {...form.getInputProps("questions")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {interview ? "Save" : "Add round"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
