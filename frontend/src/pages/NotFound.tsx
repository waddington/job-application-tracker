import { Button, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <Stack align="flex-start">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">There's nothing at this address.</Text>
      <Button component={Link} to="/" variant="light">
        Back to the overview
      </Button>
    </Stack>
  );
}
