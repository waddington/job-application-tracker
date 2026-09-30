import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconBrandGithub,
  IconBrandGoogleDrive,
  IconBrandLinkedin,
  IconCheck,
  IconFileText,
  IconLink,
  IconPencil,
  IconPresentation,
  IconTable,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";

import {
  useAddLink,
  useDeleteLink,
  useLinks,
  useUpdateLink,
  type EntityType,
  type LinkItem,
} from "../api/linkHooks";

const ICONS: Record<string, typeof IconLink> = {
  google_doc: IconFileText,
  google_sheet: IconTable,
  google_slides: IconPresentation,
  google_drive: IconBrandGoogleDrive,
  github: IconBrandGithub,
  linkedin: IconBrandLinkedin,
};

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function LinkRow({ link }: { link: LinkItem }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title ?? "");
  const update = useUpdateLink();
  const remove = useDeleteLink();
  const Icon = ICONS[link.kind] ?? IconLink;
  const label = link.title || host(link.url);
  const save = () => {
    if (title.trim() === (link.title ?? "")) return setEditing(false); // nothing changed
    update.mutate({ id: link.id, body: { title } }, { onSuccess: () => setEditing(false) });
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Icon size={18} stroke={1.6} style={{ flexShrink: 0 }} />
        {editing ? (
          <TextInput
            size="xs"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Link title"
            placeholder="Leave empty for a default"
            style={{ flex: 1 }}
            onBlur={save}
            autoFocus
          />
        ) : (
          <div style={{ minWidth: 0 }}>
            <Anchor
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              size="sm"
              fw={500}
              truncate="end"
              display="block"
            >
              {label}
            </Anchor>
            <Text size="xs" c="dimmed" truncate="end">
              {host(link.url)}
            </Text>
          </div>
        )}
      </Group>
      <Group gap={2} wrap="nowrap">
        {editing ? (
          <>
            <ActionIcon
              variant="subtle"
              color="teal"
              onClick={save}
              loading={update.isPending}
              aria-label="Save title"
            >
              <IconCheck size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={() => setEditing(false)} aria-label="Cancel">
              <IconX size={16} />
            </ActionIcon>
          </>
        ) : (
          <>
            <Tooltip label="Rename">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  setTitle(link.title ?? "");
                  setEditing(true);
                }}
                aria-label={`Rename ${label}`}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Remove">
              <ActionIcon
                variant="subtle"
                color="gray"
                loading={remove.isPending}
                onClick={() => remove.mutate(link.id)}
                aria-label={`Remove ${label}`}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </Group>
    </Group>
  );
}

/** External links on one thing: the job ad, a Google Doc brief, a take-home repo… */
export function LinksCard({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { data: links } = useLinks(entityType, entityId);
  const add = useAddLink();
  const form = useForm({
    initialValues: { url: "", title: "" },
    validate: {
      url: (v) => (/^https?:\/\/\S+$/.test(v.trim()) ? null : "Paste a link starting with https://"),
    },
  });
  const submit = form.onSubmit((v) =>
    add.mutate(
      { entity_type: entityType, entity_id: entityId, url: v.url.trim(), title: v.title.trim() || null },
      { onSuccess: () => form.reset() },
    ),
  );

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>Links</Title>
        {(links ?? []).map((link) => (
          <LinkRow key={link.id} link={link} />
        ))}
        {links && !links.length && (
          <Text size="sm" c="dimmed">
            Job ads, Google Docs, repos: anything with a URL.
          </Text>
        )}
        <form onSubmit={submit}>
          <Group align="flex-start" gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="https://docs.google.com/…"
              aria-label="Link URL"
              style={{ flex: 2 }}
              {...form.getInputProps("url")}
            />
            <TextInput
              size="xs"
              placeholder="Title (optional)"
              aria-label="Link title (optional)"
              style={{ flex: 1 }}
              {...form.getInputProps("title")}
            />
            <Button size="xs" type="submit" variant="light" loading={add.isPending}>
              Add
            </Button>
          </Group>
        </form>
      </Stack>
    </Card>
  );
}
