import { Button, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Page } from "../components/Page";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <Page align="flex-start">
      <Title order={2}>{t("notFound.title")}</Title>
      <Text c="dimmed">{t("notFound.body")}</Text>
      <Button component={Link} to="/" variant="light">
        {t("notFound.back")}
      </Button>
    </Page>
  );
}
