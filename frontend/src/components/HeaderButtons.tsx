import { ActionIcon, Box, Button, Modal, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHelp, IconPlus } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { HowItWorks } from "./HowItWorks";
import { NewApplicationModal } from "./NewApplicationModal";

// The header's buttons, kept apart from How it works' text (which moves with Today) so the
// hard-coded-text lint rule covers them.

export function HelpButton() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure();
  return (
    <>
      <Tooltip label={t("header.help")}>
        <ActionIcon variant="subtle" size="lg" aria-label={t("header.help")} onClick={open}>
          <IconHelp size={18} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={close} title={t("header.help")} size="lg">
        <HowItWorks />
      </Modal>
    </>
  );
}

/** "New application" from any page; opens the new application's page once it's added. */
export function NewApplicationButton({
  size = "sm",
  compact,
}: {
  size?: "xs" | "sm" | "md";
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure();
  const router = useRouter();
  return (
    <>
      {compact ? (
        <>
          <Box visibleFrom="sm">
            <Button size={size} leftSection={<IconPlus size={16} />} onClick={open}>
              {t("header.newApplication")}
            </Button>
          </Box>
          <Tooltip label={t("header.newApplication")}>
            <ActionIcon hiddenFrom="sm" size="lg" aria-label={t("header.newApplication")} onClick={open}>
              <IconPlus size={18} />
            </ActionIcon>
          </Tooltip>
        </>
      ) : (
        <Button size={size} leftSection={<IconPlus size={16} />} onClick={open}>
          {t("header.newApplication")}
        </Button>
      )}
      <NewApplicationModal
        opened={opened}
        onClose={(id) => {
          close();
          if (id) router.history.push(`/applications/${id}`);
        }}
      />
    </>
  );
}
