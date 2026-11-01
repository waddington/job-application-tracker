import { Anchor, Badge, Card, Group, Highlight, Loader, Stack, Text, Title } from "@mantine/core";
import {
  IconBriefcase,
  IconBuilding,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconCash,
  IconFile,
  IconFileText,
  IconHistory,
  IconLink,
  IconListCheck,
  IconNotes,
  IconPhone,
  IconSearch,
  IconTargetArrow,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";

import { eventText } from "../components/eventText";
import { PersonMarks } from "../components/GhostMark";
import { useSearchResults, type SearchHit } from "../api/searchHooks";
import { i18n } from "../i18n";

const KINDS = {
  application: { label: "notes:search.kinds.application", icon: IconBriefcase },
  role: { label: "notes:search.kinds.role", icon: IconTargetArrow },
  company: { label: "notes:search.kinds.company", icon: IconBuilding },
  agency: { label: "notes:search.kinds.agency", icon: IconBuildingSkyscraper },
  contact: { label: "notes:search.kinds.contact", icon: IconUser },
  interview: { label: "notes:search.kinds.interview", icon: IconCalendarEvent },
  meeting: { label: "notes:search.kinds.meeting", icon: IconPhone },
  todo: { label: "notes:search.kinds.todo", icon: IconListCheck },
  offer: { label: "notes:search.kinds.offer", icon: IconCash },
  timeline: { label: "notes:search.kinds.timeline", icon: IconHistory },
  note: { label: "notes:search.kinds.note", icon: IconNotes },
  document: { label: "notes:search.kinds.document", icon: IconFileText },
  file: { label: "notes:search.kinds.file", icon: IconFile },
  link: { label: "notes:search.kinds.link", icon: IconLink },
} as const;

const ROUND_KINDS = {
  screen: "notes:search.hit.roundKinds.screen",
  hiring_manager: "notes:search.hit.roundKinds.hiring_manager",
  technical: "notes:search.hit.roundKinds.technical",
  coding_task: "notes:search.hit.roundKinds.coding_task",
  system_design: "notes:search.hit.roundKinds.system_design",
  pairing: "notes:search.hit.roundKinds.pairing",
  behavioural: "notes:search.hit.roundKinds.behavioural",
  onsite: "notes:search.hit.roundKinds.onsite",
  final: "notes:search.hit.roundKinds.final",
  other: "notes:search.hit.roundKinds.other",
} as const;

const CALL_KINDS = {
  call: "notes:search.hit.callKinds.call",
  video: "notes:search.hit.callKinds.video",
  in_person: "notes:search.hit.callKinds.in_person",
} as const;

const CALL_ABOUT = {
  call: "notes:search.hit.callAbout.call",
  video: "notes:search.hit.callAbout.video",
  in_person: "notes:search.hit.callAbout.in_person",
} as const;

/** The title in your language, from the parts the API sends. Anything it can't build (a kind the
 * app doesn't know, an older server) stays as the API's own. Matches domain/search.py's wording,
 * which isn't quite a round's name elsewhere: no "Round 2" without a description. */
export function hitTitle(hit: SearchHit): string {
  if (hit.kind === "offer") return i18n.t("notes:search.hit.offer");
  if (hit.kind === "interview") {
    if (hit.own_title) {
      return hit.round
        ? i18n.t("interviews:label", { round: hit.round, what: hit.own_title })
        : hit.own_title;
    }
    if (hit.subkind && Object.hasOwn(ROUND_KINDS, hit.subkind)) {
      return i18n.t(ROUND_KINDS[hit.subkind as keyof typeof ROUND_KINDS]);
    }
  }
  if (hit.kind === "meeting" && hit.subkind && Object.hasOwn(CALL_KINDS, hit.subkind)) {
    const kind = hit.subkind as keyof typeof CALL_KINDS;
    return hit.own_title ? i18n.t(CALL_ABOUT[kind], { about: hit.own_title }) : i18n.t(CALL_KINDS[kind]);
  }
  if (hit.kind === "timeline") return eventText({ summary: hit.title, msg: hit.msg }) ?? hit.title;
  return hit.title;
}

function HitRow({ hit, words }: { hit: SearchHit; words: string[] }) {
  const { t } = useTranslation("notes");
  const known = Object.hasOwn(KINDS, hit.kind) ? KINDS[hit.kind as keyof typeof KINDS] : null;
  const KindIcon: Icon = known?.icon ?? IconSearch;
  // In-app paths open in the app; files and outside links in a new tab (web addresses only).
  const external = !hit.link.startsWith("/") || hit.link.startsWith("/api/");
  const safe = hit.link.startsWith("/") || /^https?:\/\//i.test(hit.link);
  const subtitle = hit.done ? t("search.hit.done") : hit.subtitle;
  const title = (
    <>
      {hit.kind === "contact" && <PersonMarks id={hit.id} />}
      <Highlight highlight={words} fw={600} size="sm" span>
        {hitTitle(hit)}
      </Highlight>
    </>
  );
  return (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      <KindIcon size={18} stroke={1.6} style={{ marginTop: 2, flexShrink: 0 }} />
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Group gap="xs" wrap="nowrap">
          {!safe ? (
            title
          ) : external ? (
            <Anchor href={hit.link} target="_blank" rel="noreferrer">
              {title}
            </Anchor>
          ) : (
            <Anchor component={Link} to={hit.link}>
              {title}
            </Anchor>
          )}
          <Badge size="xs" variant="light" color="gray">
            {known ? i18n.t(known.label) : hit.kind}
          </Badge>
          {hit.archived && (
            <Badge size="xs" variant="outline" color="gray">
              {t("search.archived")}
            </Badge>
          )}
        </Group>
        {subtitle && (
          <Text size="xs" c="dimmed" truncate="end">
            {subtitle}
          </Text>
        )}
        {hit.snippet && (
          <Highlight highlight={words} size="sm" c="dimmed">
            {hit.snippet}
          </Highlight>
        )}
      </Stack>
    </Group>
  );
}

/** Search results for ?q=, from the header box (P6 `search`). */
export function SearchPage() {
  const { t } = useTranslation("notes");
  const q = useRouterState({ select: (s) => (s.location.search as { q?: string }).q ?? "" });
  const { data: hits, isFetching, isError } = useSearchResults(q);
  const words = q.split(/\s+/).filter(Boolean);

  return (
    <Stack maw={900}>
      <Group gap="sm">
        <IconSearch size={26} stroke={1.6} />
        <Title order={2}>{q ? t("search.resultsFor", { q }) : t("search.title")}</Title>
        {isFetching && <Loader size="xs" />}
      </Group>
      {!q ? (
        <Text c="dimmed" size="sm">
          <Trans t={t} i18nKey="search.intro" components={{ key: <b /> }} />
        </Text>
      ) : isError ? (
        <Text c="red">{t("search.failed")}</Text>
      ) : !hits ? null : !hits.length ? (
        <Text c="dimmed" size="sm">
          {t("search.none", { q })}
        </Text>
      ) : (
        <Card withBorder>
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              {hits.length === 50 ? t("search.first50") : t("search.count", { count: hits.length })}
            </Text>
            {hits.map((h) => (
              <HitRow key={`${h.kind}:${h.id}`} hit={h} words={words} />
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
