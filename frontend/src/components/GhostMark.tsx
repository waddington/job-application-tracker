import { ActionIcon, Tooltip } from "@mantine/core";
import { IconGhost2, IconStar, IconStarFilled } from "@tabler/icons-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Contact } from "../api/client";
import { useContacts } from "../api/hooks";
import { useSetPersonReply } from "../api/peopleHooks";

/** A ghost just before the name of someone you've marked Ghosted. */
export function GhostMark({ closedAs, size = 14 }: { closedAs?: string | null; size?: number }) {
  const { t } = useTranslation("people");
  if (closedAs !== "ghosted") return null;
  return (
    <span
      title={t("marks.ghostedHint")}
      role="img"
      aria-label={t("marks.ghosted")}
      style={{ marginRight: "0.3em" }}
    >
      <IconGhost2 size={size} stroke={1.8} style={{ verticalAlign: "-0.12em" }} aria-hidden />
    </span>
  );
}

/** A gold star just before the name of one of your favourites. */
export function FavouriteMark({ on, size = 14 }: { on?: boolean | null; size?: number }) {
  const { t } = useTranslation("people");
  if (!on) return null;
  return (
    <span
      title={t("marks.favourite")}
      role="img"
      aria-label={t("marks.favourite")}
      style={{ marginRight: "0.3em" }}
    >
      <IconStarFilled
        size={size}
        style={{ verticalAlign: "-0.12em", color: "var(--mantine-color-yellow-7)" }}
        aria-hidden
      />
    </span>
  );
}

/** Star or unstar someone as a favourite. */
export function FavouriteToggle({ contact, size = "sm" }: { contact: Contact; size?: "sm" | "md" }) {
  const { t } = useTranslation("people");
  const update = useSetPersonReply();
  const on = Boolean(contact.favourite);
  return (
    <Tooltip label={on ? t("marks.unstar") : t("marks.star")}>
      <ActionIcon
        variant="subtle"
        color={on ? "yellow" : "gray"}
        size={size}
        aria-label={t("marks.favouriteWho", { name: contact.name })}
        aria-pressed={on}
        loading={update.isPending}
        onClick={() => update.mutate({ id: contact.id, body: { favourite: !on } })}
      >
        {on ? <IconStarFilled size={size === "md" ? 20 : 15} /> : <IconStar size={size === "md" ? 20 : 15} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** Whether a person (by id) is one of your favourites. */
export function useFavourite() {
  const { data: contacts } = useContacts();
  const stars = useMemo(
    () => new Set((contacts ?? []).filter((c) => c.favourite).map((c) => c.id)),
    [contacts],
  );
  return (id: string | null | undefined) => Boolean(id && stars.has(id));
}

/** Whether a person (by id) has ghosted you, from the people list everyone shares. */
export function useGhosted() {
  const { data: contacts } = useContacts();
  const ghosts = useMemo(
    () => new Set((contacts ?? []).filter((c) => c.closed_as === "ghosted").map((c) => c.id)),
    [contacts],
  );
  return (id: string | null | undefined) => Boolean(id && ghosts.has(id));
}

/** The marks before a person's name (by id): a star for a favourite, a ghost if they ghosted you. */
export function PersonMarks({ id, size }: { id: string | null | undefined; size?: number }) {
  const ghosted = useGhosted();
  const favourite = useFavourite();
  return (
    <>
      <FavouriteMark on={favourite(id)} size={size} />
      <GhostMark closedAs={ghosted(id) ? "ghosted" : null} size={size} />
    </>
  );
}

/** A person's name, with a star in front for a favourite and a ghost if they've ghosted you. */
export function PersonName({
  id,
  name,
  size,
}: {
  id: string | null | undefined;
  name: string;
  size?: number;
}) {
  return (
    <>
      <PersonMarks id={id} size={size} />
      {name}
    </>
  );
}
