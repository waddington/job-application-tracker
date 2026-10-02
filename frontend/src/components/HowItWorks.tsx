import { ActionIcon, Box, Button, List, Modal, Stack, Text, ThemeIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHelp, IconPlus } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NewApplicationModal } from "./NewApplicationModal";

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Add an application",
    body: (
      <>
        Press <b>New application</b> (top right, on any page). Type the company and role. If a recruiter
        brought it to you, choose <i>Through a recruiter</i> and type the agency and their name. Anything new
        is created for you, so there's no need to set up companies or recruiters first.
      </>
    ),
  },
  {
    title: "Move it along",
    body: (
      <>
        Drag it across the board on <b>Applications</b>, or use the stage buttons on its page, as you apply,
        hear back and interview.
      </>
    ),
  },
  {
    title: "Log what happens",
    body: (
      <>
        On the application's page: calls, emails, notes, interviews, offers and files. When you've replied and
        the ball is in their court, press <b>I've replied, waiting</b>.
      </>
    ),
  },
  {
    title: "Check Next actions",
    body: (
      <>
        Follow-ups that are due, applications that have gone quiet, interviews coming up and people to chase.
      </>
    ),
  },
  {
    title: "Look back",
    body: (
      <>
        <b>Timeline</b> shows everything that happened, across every company and person; <b>Insights</b> shows
        how the search is going.
      </>
    ),
  },
];

/** The everyday loop as numbered steps (used by the help button and the Overview). */
export function HowItWorks() {
  return (
    <Stack gap="sm">
      <List
        type="ordered"
        spacing="sm"
        center={false}
        icon={null}
        styles={{ itemWrapper: { alignItems: "flex-start" } }}
      >
        {STEPS.map((step, n) => (
          <List.Item
            key={step.title}
            icon={
              <ThemeIcon size={24} radius="xl" variant="light" aria-hidden>
                {n + 1}
              </ThemeIcon>
            }
          >
            <Text fw={600} size="sm">
              {step.title}
            </Text>
            <Text size="sm" c="dimmed">
              {step.body}
            </Text>
          </List.Item>
        ))}
      </List>
      <Text size="xs" c="dimmed">
        Someone got in touch without a specific role? Add them on <b>Recruiters</b> (agency recruiters) or on
        the company's page (people who work there).
      </Text>
    </Stack>
  );
}

export function HelpButton() {
  const [opened, { open, close }] = useDisclosure();
  return (
    <>
      <Tooltip label="How it works">
        <ActionIcon variant="subtle" size="lg" aria-label="How it works" onClick={open}>
          <IconHelp size={18} />
        </ActionIcon>
      </Tooltip>
      <Modal opened={opened} onClose={close} title="How it works" size="lg">
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
  const [opened, { open, close }] = useDisclosure();
  const router = useRouter();
  return (
    <>
      {compact ? (
        <>
          <Box visibleFrom="sm">
            <Button size={size} leftSection={<IconPlus size={16} />} onClick={open}>
              New application
            </Button>
          </Box>
          <Tooltip label="New application">
            <ActionIcon hiddenFrom="sm" size="lg" aria-label="New application" onClick={open}>
              <IconPlus size={18} />
            </ActionIcon>
          </Tooltip>
        </>
      ) : (
        <Button size={size} leftSection={<IconPlus size={16} />} onClick={open}>
          New application
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
