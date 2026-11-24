import { Alert, Button, Group, Modal, Paper, Stack, Text, Textarea } from "@mantine/core";
import { IconMessageReport, IconPencil } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ApplicationDetail } from "../api/client";
import { useMoveApplication, useSetRejectionFeedback, useWorkflow, type MoveArgs } from "../api/hooks";
import { errorText } from "../api/notifyError";
import { i18n } from "../i18n";
import defaults from "../locales/defaultStages.json";
import { stageName } from "../utils/stageName";

/** The stage that takes feedback, by its id (the server's `workflow.REJECTED`): rename it and it still does. */
export const REJECTED = "rejected";

/** The feedback part of a move's body. Sent when there's text, or to clear feedback the application
 * already has (so emptying the filled-in text clears it); otherwise left out, so an older server, which
 * has no feedback and refuses fields it doesn't know, still takes the move. Kept as written. */
export function feedbackField(
  text: string,
  existing: string | null | undefined,
): { rejection_feedback?: string } {
  if (text.trim()) return { rejection_feedback: text };
  return (existing ?? null) !== null ? { rejection_feedback: "" } : {};
}

// The server's limit, in characters (code points, as it counts them). Not enforced here, so a long
// paste is never cut short: the server refuses it and the dialog says why, keeping the text.
const MAX = 10_000;
const SHOW_COUNT_FROM = MAX - 1_000;

/** Asking for the feedback. Nothing saves until you confirm, and while saving it can't close (as with
 * How did it go?): if the save fails, what you typed is still here, with why. */
function FeedbackModal({
  title,
  subtitle,
  initial,
  confirm,
  loading,
  error,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  initial: string | null | undefined;
  confirm: string;
  loading: boolean;
  error: Error | null;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(["applications", "common"]);
  const [text, setText] = useState(initial ?? "");
  const used = [...text].length;
  const number = new Intl.NumberFormat(i18n.language);
  return (
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
        <Textarea
          label={t("rejection.label")}
          description={t("rejection.description")}
          placeholder={t("rejection.placeholder")}
          autosize
          minRows={4}
          maxRows={14}
          data-autofocus
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        {used >= SHOW_COUNT_FROM && (
          <Text size="xs" c={used > MAX ? "red" : "dimmed"} ta="right">
            {t("rejection.count", { used: number.format(used), max: number.format(MAX) })}
          </Text>
        )}
        {error && (
          <Alert color="red" title={t("rejection.notSaved")}>
            {errorText(error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {t("common:actions.cancel")}
          </Button>
          <Button loading={loading} onClick={() => onSave(text)}>
            {confirm}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type AppLike = Pick<ApplicationDetail, "company_name" | "role_title" | "rejection_feedback">;
type Asking = { args: MoveArgs; existing: string | null | undefined; where: string; onMoved?: () => void };

/**
 * Moving an application, with a stop on the way to Rejected to ask what they said. Cancelling there
 * cancels the move; leaving it empty moves it without feedback. Render `dialog` somewhere.
 */
export function useMoveAsking(): {
  request: (args: MoveArgs, app: AppLike, onMoved?: () => void) => void;
  dialog: ReactNode;
  isPending: boolean;
} {
  const { t } = useTranslation("applications");
  const move = useMoveApplication();
  const { data: workflow } = useWorkflow();
  const [asking, setAsking] = useState<Asking | null>(null);
  const request = (args: MoveArgs, app: AppLike, onMoved?: () => void) => {
    if (args.to_stage !== REJECTED) {
      move.mutate(args);
      onMoved?.();
      return;
    }
    move.reset(); // no error left from an earlier move
    const where = t("rejection.where", { company: app.company_name, role: app.role_title });
    setAsking({ args, existing: app.rejection_feedback, where, onMoved });
  };
  // As the stage shows everywhere else: a default one in your language, one you renamed as you wrote it.
  const configured = workflow?.stages.find((s) => s.id === REJECTED)?.name;
  const stage = stageName({ id: REJECTED, name: asking?.args.stageName ?? configured ?? defaults.rejected });
  const dialog = asking && (
    <FeedbackModal
      title={t("rejection.moveTitle", { stage })}
      subtitle={asking.where}
      initial={asking.existing}
      confirm={t("rejection.moveConfirm", { stage })}
      loading={move.isPending}
      error={move.error}
      onClose={() => setAsking(null)}
      onSave={(text) =>
        move.mutate(
          { ...asking.args, ...feedbackField(text, asking.existing) },
          {
            onSuccess: () => {
              asking.onMoved?.();
              setAsking(null);
            },
          },
        )
      }
    />
  );
  return { request, dialog, isPending: move.isPending };
}

/** The feedback on the application page and quick view, as written, with Add or Edit. Shown once it's
 * been rejected, or while there's feedback (kept through an undo or reopening). */
export function RejectionFeedback({ app }: { app: ApplicationDetail }) {
  const { t } = useTranslation("applications");
  const save = useSetRejectionFeedback();
  const [editing, setEditing] = useState(false);
  const feedback = app.rejection_feedback ?? null;
  if (app.stage !== REJECTED && feedback === null) return null;
  // A card of its own, with the rejection's red down its edge and its button beside the heading, so it
  // reads as part of being rejected rather than one more line of facts.
  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      maw="40rem"
      data-testid="rejection-feedback-card"
      style={{ borderLeft: "3px solid var(--mantine-color-red-6)" }}
    >
      <Group gap="xs" wrap="wrap" mb={4}>
        <IconMessageReport size={16} color="var(--mantine-color-red-6)" aria-hidden />
        <Text size="sm" fw={700}>
          {t("rejection.heading")}
        </Text>
        <Button
          size="compact-xs"
          variant={feedback === null ? "light" : "subtle"}
          leftSection={<IconPencil size={12} />}
          onClick={() => {
            save.reset(); // no error left from an earlier save
            setEditing(true);
          }}
        >
          {feedback === null ? t("rejection.add") : t("rejection.edit")}
        </Button>
      </Group>
      {feedback === null ? (
        <Text size="sm" c="dimmed">
          {t("rejection.none")}
        </Text>
      ) : (
        <Text
          size="sm"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          data-testid="rejection-feedback"
        >
          {feedback}
        </Text>
      )}
      {editing && (
        <FeedbackModal
          title={feedback === null ? t("rejection.addTitle") : t("rejection.editTitle")}
          subtitle={t("rejection.where", { company: app.company_name, role: app.role_title })}
          initial={feedback}
          confirm={t("rejection.save")}
          loading={save.isPending}
          error={save.error}
          onClose={() => setEditing(false)}
          onSave={(text) =>
            save.mutate(
              { id: app.id, feedback: text.trim() ? text : null },
              { onSuccess: () => setEditing(false) },
            )
          }
        />
      )}
    </Paper>
  );
}
