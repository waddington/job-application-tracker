import { ActionIcon, Anchor, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconBrandLinkedin, IconLink, IconMail, IconPencil, IconPhone, IconPoint } from "@tabler/icons-react";

import type { Contact } from "../api/client";

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
        <Stack gap={4}>
          <Text fw={600}>{contact.name}</Text>
          {contact.title && (
            <Text size="xs" c="dimmed">
              {contact.title}
            </Text>
          )}
          {contact.details.map((d) => {
            const Icon = ICONS[d.kind as keyof typeof ICONS] ?? IconPoint;
            const link = href(d.kind, d.value);
            return (
              <Group key={d.id} gap={6} wrap="nowrap">
                <Icon size={14} stroke={1.6} />
                {link ? (
                  <Anchor
                    href={link}
                    size="sm"
                    target={d.kind === "email" || d.kind === "phone" ? undefined : "_blank"}
                  >
                    {d.value}
                  </Anchor>
                ) : (
                  <Text size="sm">{d.value}</Text>
                )}
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
          <Tooltip label="Edit">
            <ActionIcon variant="subtle" color="gray" onClick={onEdit} aria-label={`Edit ${contact.name}`}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Card>
  );
}
