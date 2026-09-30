import { Group, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

interface Health {
  status: string;
  version: string;
  schema: string | null;
  schema_head: string;
  git_repo: boolean;
}

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/v1/health");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Health>;
}

/** A small connection indicator for the navbar footer. */
export function ApiStatus() {
  const { data, isError, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const [color, label, detail] = isPending
    ? ["gray", "Connecting…", "Checking the local API"]
    : isError || !data
      ? ["red", "API offline", "Start it with `uv run jat serve`"]
      : [
          data.git_repo ? "teal" : "yellow",
          "Connected",
          `v${data.version} · schema ${data.schema ?? "?"}${data.git_repo ? " · backups on" : " · data dir isn't a git repo"}`,
        ];

  return (
    <Tooltip label={detail} position="top-start">
      <Group gap={6} wrap="nowrap" aria-live="polite">
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: `var(--mantine-color-${color}-6)`,
            display: "inline-block",
          }}
        />
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      </Group>
    </Tooltip>
  );
}
