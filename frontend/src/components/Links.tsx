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
import { useTranslation } from "react-i18next";

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

const WEB_LINK = /^https?:\/\/\S+$/;

function LinkRow({ link }: { link: LinkItem }) {
  const { t } = useTranslation("files");
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
            aria-label={t("links.linkTitle")}
            placeholder={t("links.defaultPlaceholder")}
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
              aria-label={t("links.saveTitle")}
            >
              <IconCheck size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setEditing(false)}
              aria-label={t("links.cancel")}
            >
              <IconX size={16} />
            </ActionIcon>
          </>
        ) : (
          <>
            <Tooltip label={t("links.rename")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  setTitle(link.title ?? "");
                  setEditing(true);
                }}
                aria-label={t("links.renameNamed", { label })}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("links.remove")}>
              <ActionIcon
                variant="subtle"
                color="gray"
                loading={remove.isPending}
                onClick={() => remove.mutate(link.id)}
                aria-label={t("links.removeNamed", { label })}
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
  const { t } = useTranslation("files");
  const { data: links } = useLinks(entityType, entityId);
  const add = useAddLink();
  const form = useForm({
    initialValues: { url: "", title: "" },
    validate: {
      url: (v) => (WEB_LINK.test(v.trim()) ? null : t("links.urlError")),
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
        <Title order={4}>{t("links.title")}</Title>
        {(links ?? []).map((link) => (
          <LinkRow key={link.id} link={link} />
        ))}
        {links && !links.length && (
          <Text size="sm" c="dimmed">
            {t("links.empty")}
          </Text>
        )}
        <form onSubmit={submit}>
          <Group align="flex-start" gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder={t("links.urlPlaceholder")}
              aria-label={t("links.url")}
              style={{ flex: 2 }}
              {...form.getInputProps("url")}
            />
            <TextInput
              size="xs"
              placeholder={t("links.titlePlaceholder")}
              aria-label={t("links.titleOptional")}
              style={{ flex: 1 }}
              {...form.getInputProps("title")}
            />
            <Button size="xs" type="submit" variant="light" loading={add.isPending}>
              {t("links.add")}
            </Button>
          </Group>
        </form>
      </Stack>
    </Card>
  );
}
