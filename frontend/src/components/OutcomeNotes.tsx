import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSaveInterview, type Interview } from "../api/interviewHooks";
import { useSaveMeeting, type Meeting } from "../api/meetingHooks";
import { roundLabel } from "../utils/rounds";

type Field = { key: string; label: string; placeholder: string; initial: string | null };

/**
 * Marking something as done (or as not having happened), with somewhere to say how it went.
 * The status only changes when you save; the notes can stay empty.
 */
function OutcomeNotesModal({
  title,
  subtitle,
  fields,
  confirm,
  loading,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  fields: Field[];
  confirm: string;
  loading: boolean;
  onSave: (values: Record<string, string | null>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ""])));
  return (
    // While saving, Esc or a click outside can't close it: if the save fails, what you typed is still here.
    <Modal
      opened
      onClose={onClose}
      title={title}
      size="lg"
      closeOnEscape={!loading}
      closeOnClickOutside={!loading}
      withCloseButton={!loading}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {subtitle}
        </Text>
        {fields.map((f, i) => (
          <Textarea
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            autosize
            minRows={3}
            data-autofocus={i === 0 || undefined}
            value={values[f.key]}
            onChange={(e) => {
              // Read it now: React clears currentTarget before the updater runs.
              const value = e.currentTarget.value;
              setValues((v) => ({ ...v, [f.key]: value }));
            }}
          />
        ))}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {t("actions.cancel")}
          </Button>
          <Button
            loading={loading}
            onClick={() =>
              onSave(
                Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() ? v.trim() : null])),
              )
            }
          >
            {confirm}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** An interview round's Done (asking for the debrief and questions asked) and Didn't happen
 * (asking what happened, kept in its debrief). */
export function InterviewOutcome({ interview }: { interview: Interview }) {
  const { t } = useTranslation("today");
  const save = useSaveInterview();
  const [marking, setMarking] = useState<"done" | "cancelled" | null>(null);
  const where = t("rows.where", { company: interview.company_name, role: interview.role_title });
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-xs"
        variant="light"
        color="teal"
        aria-label={t("outcome.doneWho", { label: roundLabel(interview) })}
        onClick={() => setMarking("done")}
      >
        {t("outcome.done")}
      </Button>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        aria-label={t("outcome.didntHappenWho", { label: roundLabel(interview) })}
        onClick={() => setMarking("cancelled")}
      >
        {t("outcome.didntHappen")}
      </Button>
      {marking && (
        <OutcomeNotesModal
          title={
            marking === "done"
              ? t("outcome.howDidItGo", { label: roundLabel(interview) })
              : t("outcome.didntHappenTitle", { label: roundLabel(interview) })
          }
          subtitle={where}
          fields={
            marking === "done"
              ? [
                  {
                    key: "debrief",
                    label: t("outcome.debrief"),
                    placeholder: t("outcome.debriefPlaceholder"),
                    initial: interview.debrief,
                  },
                  {
                    key: "questions",
                    label: t("outcome.questions"),
                    placeholder: t("outcome.questionsPlaceholder"),
                    initial: interview.questions,
                  },
                ]
              : [
                  {
                    key: "debrief",
                    label: t("outcome.whatHappened"),
                    placeholder: t("outcome.roundPlaceholder"),
                    initial: interview.debrief,
                  },
                ]
          }
          confirm={marking === "done" ? t("outcome.markDone") : t("outcome.markDidntHappen")}
          loading={save.isPending}
          onClose={() => setMarking(null)}
          onSave={(notes) =>
            save.mutate(
              { id: interview.id, body: { status: marking, ...notes } },
              { onSuccess: () => setMarking(null) },
            )
          }
        />
      )}
    </Group>
  );
}

/** A call's Didn't happen, asking what happened (its notes) first. */
export function MeetingDidntHappen({ meeting }: { meeting: Meeting }) {
  const { t } = useTranslation("today");
  const save = useSaveMeeting();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        aria-label={t("outcome.didntHappenWho", { label: meeting.label })}
        onClick={() => setOpen(true)}
      >
        {t("outcome.didntHappen")}
      </Button>
      {open && (
        <OutcomeNotesModal
          title={t("outcome.didntHappenTitle", { label: meeting.label })}
          subtitle={t("outcome.callSubtitle")}
          fields={[
            {
              key: "notes",
              label: t("outcome.whatHappened"),
              placeholder: t("outcome.callPlaceholder"),
              initial: meeting.notes,
            },
          ]}
          confirm={t("outcome.markDidntHappen")}
          loading={save.isPending}
          onClose={() => setOpen(false)}
          onSave={(notes) =>
            save.mutate(
              { id: meeting.id, body: { status: "cancelled", ...notes } },
              { onSuccess: () => setOpen(false) },
            )
          }
        />
      )}
    </>
  );
}
