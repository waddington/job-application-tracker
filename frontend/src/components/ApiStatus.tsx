import { Group, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api, type Health } from "../api/client";

export type { Health };

async function fetchHealth(): Promise<Health> {
  const { data, error, response } = await api.GET("/api/v1/health");
  if (error || !data) throw new Error(`HTTP ${response.status}`);
  return data;
}

/** The running server's health, checked every 30 seconds; shared by the dot and the version. */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** A small connection indicator for the navbar footer. */
export function ApiStatus() {
  const { t } = useTranslation();
  const { data, isError, isPending } = useHealth();

  const snapshotsOn = data ? (data.snapshots_enabled ?? data.git_repo) : false;
  const versions = { version: String(data?.version), schema: data?.schema ?? "?" };

  const [color, label, detail] = isPending
    ? ["gray", t("api.connecting"), t("api.connectingHint")]
    : isError || !data
      ? ["red", t("api.offline"), t("api.offlineHint")]
      : [
          snapshotsOn ? "teal" : "yellow",
          t("api.connected"),
          snapshotsOn
            ? t("api.detailsBackups", versions)
            : data.git_repo && data.windows
              ? t("api.detailsWindowsNoSnapshots", versions)
              : t("api.detailsNoGit", versions),
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
