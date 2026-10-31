import { i18n } from "../i18n";

type Named = { kind: string; title: string | null; contact_name: string };

/**
 * A call's name, "Call with Alex Morgan: market catch-up". Built here because the API's `label` is
 * English: it matches `label()` in api/meetings.py, which stays for the API's other readers. What
 * it's about and who it's with are shown as written.
 */
export function callLabel({ kind, title, contact_name: name }: Named): string {
  const what =
    kind === "call"
      ? i18n.t("calls:name.call", { name })
      : kind === "video"
        ? i18n.t("calls:name.video", { name })
        : kind === "in_person"
          ? i18n.t("calls:name.in_person", { name })
          : i18n.t("calls:name.other", { kind, name });
  return title ? i18n.t("calls:name.withAbout", { what, about: title }) : what;
}
