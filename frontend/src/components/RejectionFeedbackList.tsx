import { Anchor, Card, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useRejections, type Rejection } from "../api/insightHooks";
import { joinSentences } from "../utils/list";
import { stageName } from "../utils/stageName";
import { formatDate } from "../utils/time";
import { RecruiterLine } from "./RecruiterLine";
import { REJECTED } from "./RejectionFeedback";
import { LineSkeleton } from "./PageSkeleton";
import { Loading } from "./QueryState";

/** When it was rejected and from where, then where it is now if that's somewhere else. */
function rejectionLine(r: Rejection, t: ReturnType<typeof useTranslation<"insights">>["t"]): string {
  const now = stageName({ id: r.stage, name: r.stage_name });
  if (!r.rejected_at) return t("rejections.undone", { stage: now });
  const date = formatDate(r.rejected_at);
  const when = r.added_at_rejected
    ? t("rejections.addedAt", { date })
    : t("rejections.rejectedFrom", {
        date,
        stage: stageName({ id: r.rejected_from, name: r.rejected_from_name ?? r.rejected_from ?? "" }),
      });
  return r.stage === REJECTED ? when : joinSentences(when, t("rejections.nowAt", { stage: now }));
}

function RejectionItem({ r }: { r: Rejection }) {
  const { t } = useTranslation("insights");
  return (
    <Card
      withBorder
      padding="sm"
      component="li"
      aria-label={t("rejections.itemLabel", { company: r.company_name, role: r.role_title })}
    >
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          <RecruiterLine id={r.recruiter_id} name={r.recruiter_name}>
            <Anchor component={Link} to={`/applications/${r.application_id}`} inherit>
              {t("rejections.title", { company: r.company_name, role: r.role_title })}
            </Anchor>
          </RecruiterLine>
        </Text>
        <Text size="xs" c="dimmed">
          {rejectionLine(r, t)}
        </Text>
        <Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {r.feedback}
        </Text>
      </Stack>
    </Card>
  );
}

/** Every rejection's feedback in one place, newest first; a period goes by when it was rejected. */
export function RejectionsSection({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const { data, isLoading, isError } = useRejections(since);
  return (
    <Card withBorder>
      <Title order={4}>{t("rejections.heading")}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {t(since ? "rejections.introPeriod" : "rejections.intro")}
      </Text>
      {isLoading ? (
        // One line: the count, or the text for none (as on the demo, which has no feedback).
        <Loading>
          <LineSkeleton height={20} width="20rem" />
        </Loading>
      ) : isError || !data ? (
        <Text c="red">{t("rejections.loadFailed")}</Text>
      ) : !data.length ? (
        <Text size="sm" c="dimmed">
          {t(since ? "rejections.noneInPeriod" : "rejections.none")}
        </Text>
      ) : (
        <Stack gap="sm">
          <Text size="sm">{t("rejections.count", { count: data.length })}</Text>
          <Stack gap="sm" component="ul" p={0} m={0} style={{ listStyle: "none" }}>
            {data.map((r) => (
              <RejectionItem key={r.application_id} r={r} />
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  );
}
