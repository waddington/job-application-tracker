import { Group, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { data, isError, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const [color, label, detail] = isPending
    ? ["gray", t("api.connecting"), t("api.connectingHint")]
    : isError || !data
      ? ["red", t("api.offline"), t("api.offlineHint")]
      : [
          data.git_repo ? "teal" : "yellow",
          t("api.connected"),
          data.git_repo
            ? t("api.detailsBackups", { version: String(data.version), schema: data.schema ?? "?" })
            : t("api.detailsNoGit", { version: String(data.version), schema: data.schema ?? "?" }),
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
