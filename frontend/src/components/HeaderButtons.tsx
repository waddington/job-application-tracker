import { ActionIcon, Box, Button, Menu, Modal, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconHelp, IconLanguage, IconPlus } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { isLanguage, LANGUAGE_NAMES, LANGUAGES, PSEUDO, saveLanguage } from "../i18n/language";
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

/**
 * Change the language by hand (docs/rfc/i18n.md §6): the shipped languages by their own names,
 * then "Coming soon!" until a second one ships. The choice is kept in this browser. In dev, the
 * pseudo-language is offered too.
 */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const [opened, setOpened] = useState(false);
  const choose = (lang: string) => {
    void i18n.changeLanguage(lang);
    if (isLanguage(lang)) saveLanguage(lang);
  };
  const current = (lang: string) =>
    i18n.resolvedLanguage === lang
      ? { rightSection: <IconCheck size={14} aria-hidden />, "aria-current": "true" as const }
      : {};
  return (
    <Menu position="bottom-end" withinPortal onChange={setOpened}>
      {/* Tooltip outside Menu.Target, so the button itself gets the menu's aria-haspopup and
          aria-expanded; hidden while the menu is open. */}
      <Tooltip label={t("language.label")} disabled={opened}>
        <Menu.Target>
          <ActionIcon variant="subtle" size="lg" aria-label={t("language.label")}>
            <IconLanguage size={18} />
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>
        <Menu.Label>{t("language.label")}</Menu.Label>
        {LANGUAGES.map((lang) => (
          <Menu.Item key={lang} lang={lang} onClick={() => choose(lang)} {...current(lang)}>
            {LANGUAGE_NAMES[lang]}
          </Menu.Item>
        ))}
        <Menu.Item disabled>{t("language.comingSoon")}</Menu.Item>
        {import.meta.env.DEV && (
          <Menu.Item onClick={() => choose(PSEUDO)} {...current(PSEUDO)}>
            {t("language.pseudo")}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
