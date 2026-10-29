import { ActionIcon, Box, Button, Menu, Modal, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconHelp, IconLanguage, IconPlus } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LANGUAGE_NAMES, LANGUAGES, PSEUDO, saveLanguage } from "../i18n/language";
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
  const choose = (lang: string) => {
    void i18n.changeLanguage(lang);
    if ((LANGUAGES as readonly string[]).includes(lang)) saveLanguage(lang as (typeof LANGUAGES)[number]);
  };
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={t("language.label")}>
          <ActionIcon variant="subtle" size="lg" aria-label={t("language.label")}>
            <IconLanguage size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("language.label")}</Menu.Label>
        {LANGUAGES.map((lang) => (
          <Menu.Item
            key={lang}
            lang={lang}
            onClick={() => choose(lang)}
            rightSection={i18n.language === lang ? <IconCheck size={14} aria-hidden /> : null}
            aria-current={i18n.language === lang ? "true" : undefined}
          >
            {LANGUAGE_NAMES[lang]}
          </Menu.Item>
        ))}
        <Menu.Item disabled>{t("language.comingSoon")}</Menu.Item>
        {import.meta.env.DEV && (
          <Menu.Item
            onClick={() => choose(PSEUDO)}
            rightSection={i18n.language === PSEUDO ? <IconCheck size={14} aria-hidden /> : null}
          >
            {t("language.pseudo")}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
