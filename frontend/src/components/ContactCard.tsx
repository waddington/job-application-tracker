import { ActionIcon, Anchor, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconBrandLinkedin, IconLink, IconMail, IconPencil, IconPhone, IconPoint } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import type { Contact } from "../api/client";
import { DeleteButton } from "./DeleteButton";

const ICONS = {
  email: IconMail,
  phone: IconPhone,
  linkedin: IconBrandLinkedin,
  url: IconLink,
  other: IconPoint,
};

function href(kind: string, value: string): string | undefined {
  if (kind === "email") return `mailto:${value}`;
  // Drop any extension ("ext. 12", "x12") so the dialler gets just the number.
  if (kind === "phone") return `tel:${value.replace(/\s*(ext\.?|x)\s*\d+\s*$/i, "").replace(/[^\d+]/g, "")}`;
  if (/^https?:\/\//.test(value)) return value;
  return undefined;
}

/** A person with every way to reach them. Links open your mail client, dialler or browser. */
export function ContactCard({ contact, onEdit }: { contact: Contact; onEdit?: () => void }) {
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        {/* minWidth 0 lets long details shrink (ending in …) instead of pushing the buttons out */}
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Anchor component={Link} to={`/people/${contact.id}`} fw={600} c="inherit">
            {contact.name}
          </Anchor>
          {contact.title && (
            <Text size="xs" c="dimmed">
              {contact.title}
            </Text>
          )}
          {contact.details.map((d) => {
            const Icon = ICONS[d.kind as keyof typeof ICONS] ?? IconPoint;
            const link = href(d.kind, d.value);
            return (
              <Group key={d.id} gap={6} wrap="wrap" style={{ rowGap: 0 }}>
                {/* The icon stays with the value; only the label moves down when it's tight. */}
                <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                  <Icon size={14} stroke={1.6} style={{ flexShrink: 0 }} />
                  {link ? (
                    <Anchor
                      href={link}
                      size="sm"
                      target={d.kind === "email" || d.kind === "phone" ? undefined : "_blank"}
                      truncate="end"
                      title={d.value}
                    >
                      {d.value}
                    </Anchor>
                  ) : (
                    <Text size="sm" truncate="end" title={d.value}>
                      {d.value}
                    </Text>
                  )}
                </Group>
                {d.label && (
                  <Text size="xs" c="dimmed">
                    {d.label}
                  </Text>
                )}
              </Group>
            );
          })}
          {!contact.details.length && (
            <Text size="xs" c="dimmed">
              No contact details yet.
            </Text>
          )}
        </Stack>
        {onEdit && (
          <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label="Edit">
              <ActionIcon variant="subtle" color="gray" onClick={onEdit} aria-label={`Edit ${contact.name}`}>
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <DeleteButton
              compact
              kind="contact"
              id={contact.id}
              name={contact.name}
              confirm={`Delete ${contact.name}? They come off the applications and interviews they're on, and their calls are deleted; the applications themselves stay.`}
            />
          </Group>
        )}
      </Group>
    </Card>
  );
}
