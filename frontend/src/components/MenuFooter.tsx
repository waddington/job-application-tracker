import { Anchor, Group, Stack, Text, Tooltip, type StackProps } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { ApiStatus } from "./ApiStatus";
import { AppVersion } from "./AppVersion";

/** The foot of the menu: the connection, Download a backup and the version. In the sidebar, or the More sheet. */
export function MenuFooter(props: StackProps) {
  const { t } = useTranslation();
  return (
    <Stack gap={4} {...props}>
      <ApiStatus />
      <Text size="xs" c="dimmed">
        {t("footer.localFirst")}
      </Text>
      <Tooltip label={t("footer.backupHint")}>
        <Anchor href="/api/v1/backup/archive" download size="xs">
          <Group gap={4} wrap="nowrap">
            <IconDownload size={12} /> {t("footer.backup")}
          </Group>
        </Anchor>
      </Tooltip>
      <AppVersion />
    </Stack>
  );
}
