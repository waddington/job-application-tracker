import {
  Alert,
  Anchor,
  Box,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import {
  useDocumentPerformance,
  type DocumentKindPerformance,
  type DocumentTally,
  type FlowFilters,
} from "../api/insightHooks";
import { i18n } from "../i18n";
import { TOO_FEW, verdict } from "../utils/abtest";
import { useCvFilesToSort } from "./CvFiles";
import { daysText } from "./Scorecard";

function kindLabel(kind: string) {
  if (kind === "cv") return i18n.t("insights:documents.kinds.cv");
  if (kind === "cover_letter") return i18n.t("insights:documents.kinds.cover_letter");
  if (kind === "other") return i18n.t("insights:documents.kinds.other");
  return kind;
}

/** "Which CV works best"; a kind the app doesn't know is a document. */
function bestTitle(kind: string | undefined) {
  if (kind === "cv" || kind === undefined) return i18n.t("insights:documents.best.cv");
  if (kind === "cover_letter") return i18n.t("insights:documents.best.cover_letter");
  return i18n.t("insights:documents.best.other");
}

function noneLabel(kind: string) {
  if (kind === "cv") return i18n.t("insights:documents.none.cv");
  if (kind === "cover_letter") return i18n.t("insights:documents.none.cover_letter");
  return null;
}

type Measure = "heard_back" | "interviewed" | "offers";

/** One side of a comparison, as a sentence per measure. */
function saySide(measure: Measure, values: { name: string; hits: number; sent: number; percent: string }) {
  if (measure === "heard_back") return i18n.t("insights:documents.compare.say.heard_back", values);
  if (measure === "interviewed") return i18n.t("insights:documents.compare.say.interviewed", values);
  return i18n.t("insights:documents.compare.say.offers", values);
}

const percent = (n: number, of: number) =>
  of ? i18n.t("insights:percent", { percent: Math.round((n / of) * 100) }) : "—";

/** A row you can compare: a version, a whole document, or "none recorded". */
interface Row {
  id: string;
  name: string;
  /** How a row reads under its document: the version alone. */
  short?: string;
  tally: DocumentTally;
  level: "document" | "version" | "none";
  docId?: string;
}

/** A document and one of its own versions share applications: not a fair comparison. */
const overlaps = (x: Row, y: Row) =>
  x.docId !== undefined && x.docId === y.docId && (x.level === "document" || y.level === "document");

function rowsOf(kind: DocumentKindPerformance): Row[] {
  const rows: Row[] = [];
  for (const d of kind.documents) {
    rows.push({ id: `doc:${d.id}`, name: d.name, tally: d, level: "document", docId: d.id });
    // One version is the document itself: no need to say it twice.
    if (d.versions.length > 1)
      for (const v of d.versions)
        rows.push({
          id: `version:${v.id}`,
          name: i18n.t("insights:documents.version", { document: d.name, version: v.label }),
          short: v.label,
          tally: v,
          level: "version",
          docId: d.id,
        });
  }
  const none = noneLabel(kind.kind);
  if (none && kind.none.sent > 0) rows.push({ id: "none", name: none, tally: kind.none, level: "none" });
  return rows;
}

/** The interview rate as a dot, with its 95% range as a bar: wide means unsure. */
function RangeBar({ tally }: { tally: DocumentTally }) {
  const { t } = useTranslation("insights");
  if (tally.interview_rate == null || tally.interview_low == null || tally.interview_high == null)
    return null;
  const low = Math.round(tally.interview_low * 100);
  const high = Math.round(tally.interview_high * 100);
  return (
    <Tooltip label={t("documents.range", { low, high })}>
      <Box
        w={90}
        h={10}
        pos="relative"
        style={{ background: "var(--mantine-color-default-border)", borderRadius: 5 }}
        aria-label={t("documents.rangeShort", { low, high })}
        role="img"
      >
        <Box
          pos="absolute"
          h={10}
          left={`${low}%`}
          w={`${Math.max(high - low, 2)}%`}
          style={{ background: "var(--mantine-color-indigo-light)", borderRadius: 5 }}
        />
        <Box
          pos="absolute"
          top={1}
          w={8}
          h={8}
          left={`calc(${tally.interview_rate * 100}% - 4px)`}
          style={{ background: "var(--mantine-color-indigo-filled)", borderRadius: "50%" }}
        />
      </Box>
    </Tooltip>
  );
}

function VersionsTable({ rows }: { rows: Row[] }) {
  const { t } = useTranslation("insights");
  return (
    <Table.ScrollContainer minWidth={820}>
      <Table striped highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th />
            <Table.Th ta="right">{t("documents.table.sent")}</Table.Th>
            <Table.Th ta="right">{t("documents.table.heardBack")}</Table.Th>
            <Table.Th ta="right">{t("documents.table.interviewed")}</Table.Th>
            <Table.Th>{t("documents.table.sure")}</Table.Th>
            <Table.Th ta="right">{t("documents.table.offers")}</Table.Th>
            <Table.Th ta="right">{t("documents.table.outcomes")}</Table.Th>
            <Table.Th ta="right">{t("documents.table.reply")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ id, name, short, tally, level }) => (
            <Table.Tr key={id}>
              <Table.Td pl={level === "version" ? "xl" : undefined}>
                <Text
                  size="sm"
                  fw={level === "document" ? 600 : 400}
                  c={level === "none" ? "dimmed" : undefined}
                >
                  {short ?? name}
                </Text>
              </Table.Td>
              <Table.Td ta="right">{tally.sent}</Table.Td>
              <Table.Td ta="right">
                {tally.heard_back}{" "}
                <Text span size="xs" c="dimmed">
                  ({percent(tally.heard_back, tally.sent)})
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                {tally.interviewed}{" "}
                <Text span size="xs" c="dimmed">
                  ({percent(tally.interviewed, tally.sent)})
                </Text>
              </Table.Td>
              <Table.Td>
                <RangeBar tally={tally} />
              </Table.Td>
              <Table.Td ta="right">{tally.offers}</Table.Td>
              <Table.Td ta="right">
                {tally.open} · {tally.ghosted} · {tally.closed}
              </Table.Td>
              <Table.Td ta="right">{daysText(tally.median_reply_days)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

const VERDICT_TEXT = {
  "too-few": (first: string, second: string) =>
    i18n.t("insights:documents.compare.verdict.tooFew", { min: TOO_FEW, first, second }),
  same: (first: string, second: string) =>
    i18n.t("insights:documents.compare.verdict.same", { first, second }),
  hint: (first: string, second: string) =>
    i18n.t("insights:documents.compare.verdict.hint", { first, second }),
  likely: (first: string, second: string) =>
    i18n.t("insights:documents.compare.verdict.likely", { first, second }),
};

/** Pick two rows and a measure; says in words whether the gap is likely real. */
function Compare({ rows }: { rows: Row[] }) {
  const { t } = useTranslation("insights");
  // The two most-sent versions (or documents, when none has versions to compare) to start with.
  const versions = rows.filter((r) => r.level === "version");
  const pool = [...(versions.length >= 2 ? versions : rows.filter((r) => r.level !== "version"))].sort(
    (x, y) => y.tally.sent - x.tally.sent,
  );
  const [picked, setPicked] = useState<{ a?: string | null; b?: string | null }>({});
  const [measure, setMeasure] = useState<Measure>("interviewed");
  // A pick that's gone (another date range, say) falls back to the defaults.
  const a = rows.find((r) => r.id === picked.a) ?? pool[0];
  const b = rows.find((r) => r.id === picked.b && (!a || !overlaps(a, r))) ?? pool.find((r) => r !== a);
  const optionsBesides = (other: Row | undefined) =>
    rows.map((r) => ({ value: r.id, label: r.name, disabled: Boolean(other && overlaps(other, r)) }));
  if (rows.length < 2)
    return (
      <Text size="sm" c="dimmed">
        {t("documents.compare.onlyOne")}
      </Text>
    );

  let result: { kind: keyof typeof VERDICT_TEXT; p: number; text: string } | null = null;
  if (a && b && a.id !== b.id) {
    const hits = (r: Row) => r.tally[measure];
    const v = verdict(hits(a), a.tally.sent, hits(b), b.tally.sent);
    const say = (r: Row) =>
      saySide(measure, {
        name: r.name,
        hits: hits(r),
        sent: r.tally.sent,
        percent: percent(hits(r), r.tally.sent),
      });
    const [first, second] = hits(a) / (a.tally.sent || 1) >= hits(b) / (b.tally.sent || 1) ? [a, b] : [b, a];
    result = { ...v, text: VERDICT_TEXT[v.kind](say(first), say(second)) };
  }

  return (
    <Stack gap="xs">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label={t("documents.compare.compare")}
          data={optionsBesides(b)}
          value={a?.id ?? null}
          onChange={(v) => setPicked((p) => ({ ...p, a: v }))}
          allowDeselect={false}
          w={240}
        />
        <Select
          label={t("documents.compare.with")}
          data={optionsBesides(a)}
          value={b?.id ?? null}
          onChange={(v) => setPicked((p) => ({ ...p, b: v }))}
          allowDeselect={false}
          w={240}
        />
        <SegmentedControl
          aria-label={t("documents.compare.measure")}
          size="xs"
          data={[
            { value: "heard_back", label: t("documents.compare.measures.heard_back") },
            { value: "interviewed", label: t("documents.compare.measures.interviewed") },
            { value: "offers", label: t("documents.compare.measures.offers") },
          ]}
          value={measure}
          onChange={(v) => setMeasure(v as Measure)}
        />
      </Group>
      {result ? (
        <Alert
          color={result.kind === "likely" ? "green" : result.kind === "hint" ? "yellow" : "gray"}
          variant="light"
          title={
            result.kind === "too-few"
              ? t("documents.compare.titles.tooFew")
              : result.kind === "likely"
                ? t("documents.compare.titles.likely")
                : result.kind === "hint"
                  ? t("documents.compare.titles.hint")
                  : t("documents.compare.titles.same")
          }
        >
          <Text size="sm">{result.text}</Text>
          {result.kind !== "too-few" && (
            <Text size="xs" c="dimmed" mt={4}>
              {result.p < 0.001
                ? t("documents.compare.fisherSmall")
                : t("documents.compare.fisher", { p: result.p.toFixed(3) })}
            </Text>
          )}
        </Alert>
      ) : (
        <Text size="sm" c="dimmed">
          {t("documents.compare.pickTwo")}
        </Text>
      )}
    </Stack>
  );
}

/** Insights tab: your CVs and cover letters, version against version (an A/B test). */
export function DocumentPerformanceSection({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const [route, setRoute] = useState("any");
  const [kind, setKind] = useState("cv");
  const filters: FlowFilters = {
    since,
    route: route === "any" ? undefined : (route as FlowFilters["route"]),
  };
  const { data, isLoading, isError } = useDocumentPerformance(filters);
  const toSort = useCvFilesToSort();

  if (isLoading) return <Loader />;
  if (isError || !data) return <Text c="red">{t("documents.loadFailed")}</Text>;
  const current = data.kinds.find((k) => k.kind === kind) ?? data.kinds[0];
  const rows = current ? rowsOf(current) : [];
  const recorded = current?.documents.some((d) => d.sent > 0) ?? false;

  return (
    <Stack>
      {toSort > 0 && (
        <Alert color="blue" variant="light">
          <Text size="sm">
            <Trans
              t={t}
              i18nKey="documents.toSort"
              count={toSort}
              components={{ place: <Anchor component={Link} to="/documents" size="sm" /> }}
            />
          </Text>
        </Alert>
      )}
      <Card withBorder>
        <Group justify="space-between" mb="md" wrap="wrap" align="flex-start">
          <div>
            <Title order={4}>{bestTitle(current?.kind)}</Title>
            <Text size="sm" c="dimmed" maw={720}>
              <Trans t={t} i18nKey="documents.intro" count={data.applications} components={{ b: <b /> }} />
            </Text>
          </div>
          <Group gap="xs">
            {data.kinds.length > 1 && (
              <SegmentedControl
                aria-label={t("documents.kind")}
                size="xs"
                data={data.kinds.map((k) => ({ value: k.kind, label: kindLabel(k.kind) }))}
                value={current?.kind ?? "cv"}
                onChange={setKind}
              />
            )}
            <Select
              aria-label={t("routes.label")}
              size="xs"
              w={150}
              data={[
                { value: "any", label: t("routes.any") },
                { value: "direct", label: t("routes.direct") },
                { value: "agency", label: t("routes.agency") },
                { value: "referral", label: t("routes.referral") },
              ]}
              value={route}
              onChange={(v) => setRoute(v ?? "any")}
              allowDeselect={false}
            />
          </Group>
        </Group>
        {!recorded ? (
          <Text size="sm" c="dimmed">
            <Trans
              t={t}
              i18nKey="documents.nothing"
              components={{ place: <Anchor component={Link} to="/documents" />, card: <i /> }}
            />
          </Text>
        ) : (
          <Stack gap="lg">
            <VersionsTable rows={rows} />
            <Compare key={`${current?.kind}-${route}-${since}`} rows={rows.filter((r) => r.tally.sent > 0)} />
          </Stack>
        )}
      </Card>
      <Text size="xs" c="dimmed" maw={820}>
        <Trans t={t} i18nKey="documents.explain" components={{ b: <b /> }} />
      </Text>
    </Stack>
  );
}
