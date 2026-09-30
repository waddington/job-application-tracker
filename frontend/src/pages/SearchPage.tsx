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
  IconNotes,
  IconSearch,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";

import { useSearchResults, type SearchHit } from "../api/searchHooks";

const KINDS: Record<string, { label: string; icon: Icon }> = {
  application: { label: "Application", icon: IconBriefcase },
  company: { label: "Company", icon: IconBuilding },
  agency: { label: "Agency", icon: IconBuildingSkyscraper },
  contact: { label: "Person", icon: IconUser },
  interview: { label: "Interview", icon: IconCalendarEvent },
  offer: { label: "Offer", icon: IconCash },
  timeline: { label: "Timeline", icon: IconHistory },
  note: { label: "Note", icon: IconNotes },
  document: { label: "Document", icon: IconFileText },
  file: { label: "File", icon: IconFile },
  link: { label: "Link", icon: IconLink },
};

function HitRow({ hit, words }: { hit: SearchHit; words: string[] }) {
  const kind = KINDS[hit.kind] ?? { label: hit.kind, icon: IconSearch };
  const external = !hit.link.startsWith("/") || hit.link.startsWith("/api/");
  const title = (
    <Highlight highlight={words} fw={600} size="sm" span>
      {hit.title}
    </Highlight>
  );
  return (
    <Group wrap="nowrap" align="flex-start" gap="sm">
      <kind.icon size={18} stroke={1.6} style={{ marginTop: 2, flexShrink: 0 }} />
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Group gap="xs" wrap="nowrap">
          {external ? (
            <Anchor href={hit.link} target="_blank" rel="noreferrer">
              {title}
            </Anchor>
          ) : (
            <Anchor component={Link} to={hit.link}>
              {title}
            </Anchor>
          )}
          <Badge size="xs" variant="light" color="gray">
            {kind.label}
          </Badge>
        </Group>
        {hit.subtitle && (
          <Text size="xs" c="dimmed" truncate="end">
            {hit.subtitle}
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
  const q = useRouterState({ select: (s) => (s.location.search as { q?: string }).q ?? "" });
  const { data: hits, isFetching, isError } = useSearchResults(q);
  const words = q.split(/\s+/).filter(Boolean);

  return (
    <Stack maw={900}>
      <Group gap="sm">
        <IconSearch size={26} stroke={1.6} />
        <Title order={2}>{q ? `Results for “${q}”` : "Search"}</Title>
        {isFetching && <Loader size="xs" />}
      </Group>
      {!q ? (
        <Text c="dimmed" size="sm">
          Type in the search box at the top (or press <b>/</b>) to search applications, people, notes,
          interview debriefs, offers, emails, files and links.
        </Text>
      ) : isError ? (
        <Text c="red">Search didn't work. Is the tracker running?</Text>
      ) : !hits ? null : !hits.length ? (
        <Text c="dimmed" size="sm">
          Nothing matches every word of “{q}”. Try fewer or shorter words.
        </Text>
      ) : (
        <Card withBorder>
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              {hits.length === 50
                ? "The first 50 results"
                : `${hits.length} result${hits.length === 1 ? "" : "s"}`}
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
