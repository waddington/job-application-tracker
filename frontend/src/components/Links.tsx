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
import { useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import {
  useAddLink,
  useDeleteLink,
  useLinks,
  useUpdateLink,
  type EntityType,
  type LinkItem,
} from "../api/linkHooks";
import { QueryState } from "./QueryState";

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
  // Whether the editor is open: false as soon as it starts closing, so a blur while it closes doesn't save.
  const open = useRef(false);
  // The title being saved, and a newer one asked for meanwhile: one save at a time, never the same one twice.
  const sending = useRef<string | null>(null);
  const queued = useRef<string | null>(null);
  // Counts openings, so a save from an earlier opening doesn't close the editor reopened since.
  const opening = useRef(0);
  const startEditing = () => {
    setTitle(sending.current ?? link.title ?? ""); // a title still being saved is the newest one
    open.current = true;
    opening.current += 1;
    setEditing(true);
  };
  const close = () => {
    open.current = false;
    queued.current = null; // cancelling drops a title waiting to be saved
    setEditing(false);
  };
  const send = (value: string) => {
    const from = opening.current;
    sending.current = value;
    update.mutate(
      { id: link.id, body: { title: value } },
      {
        onSuccess: () => {
          const next = queued.current;
          sending.current = queued.current = null;
          if (!open.current) return; // cancelled meanwhile: nothing more to send or close
          if (next !== null && next !== value) send(next);
          else if (next !== null || from === opening.current) close();
        },
        onError: () => {
          // The box keeps the text to try again; a title queued behind the failed save is dropped.
          sending.current = queued.current = null;
        },
      },
    );
  };
  const save = () => {
    if (!open.current) return;
    if (sending.current !== null) {
      queued.current = title; // sent after the one in flight, unless it's the same
      return;
    }
    if (title.trim() === (link.title ?? "")) return close(); // nothing changed
    send(title);
  };

  // Leaving the editor saves, but moving between the box, the tick and the X doesn't: those buttons decide.
  const saveIfLeaving = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save();
  };
  // A press on the tick or X keeps focus in the box, so it doesn't blur (and save) before the click runs.
  const keepFocus = (e: MouseEvent) => e.preventDefault();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" onBlur={saveIfLeaving}>
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Icon size={18} stroke={1.6} style={{ flexShrink: 0 }} />
        {editing ? (
          <TextInput
            size="xs"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") close();
            }}
            aria-label={t("links.linkTitle")}
            placeholder={t("links.defaultPlaceholder")}
            style={{ flex: 1 }}
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
              onMouseDown={keepFocus}
              onClick={save}
              loading={update.isPending}
              aria-label={t("links.saveTitle")}
            >
              <IconCheck size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              onMouseDown={keepFocus}
              onClick={close}
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
                onClick={startEditing}
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

/** One skeleton row while the links load, a link's height (most cards hold none or one). */
const ROW_HEIGHT = 37;

/** External links on one thing: the job ad, a Google Doc brief, a take-home repo… */
export function LinksCard({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { t } = useTranslation("files");
  const links = useLinks(entityType, entityId);
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
        <QueryState
          query={links}
          rows={1}
          rowHeight={ROW_HEIGHT}
          empty={
            <Text size="sm" c="dimmed">
              {t("links.empty")}
            </Text>
          }
        >
          {(list) => list.map((link) => <LinkRow key={link.id} link={link} />)}
        </QueryState>
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
