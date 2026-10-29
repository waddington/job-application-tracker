import { Button, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";

import { shadow } from "../i18n/shadow";

export function NotFound() {
  return (
    <Stack align="flex-start">
      <Title order={2}>{shadow("common:notFound.title", "Page not found")}</Title>
      <Text c="dimmed">{shadow("common:notFound.body", "There's nothing at this address.")}</Text>
      <Button component={Link} to="/" variant="light">
        {shadow("common:notFound.back", "Back to Today")}
      </Button>
    </Stack>
  );
}
