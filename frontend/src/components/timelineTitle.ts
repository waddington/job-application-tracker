import type { TimelineItem } from "../api/timelineHooks";
import { i18n } from "../i18n";

/**
 * What a Timeline entry is called, in your language. Kinds with no text here (stage moves, rounds, calls,
 * notes and so on: i18n-timeline-records), and every entry from an older server, which sends no `kind`,
 * show the API's English `title`. A name that's missing where the sentence needs one does the same.
 */
export function timelineTitle(item: TimelineItem): string {
  const person = item.people[0]?.name;
  const role = item.role_title;
  const company = item.company_name;
  const agency = item.agency_name;
  switch (item.kind) {
    case "role":
      if (person == null || role == null) break;
      return company == null
        ? i18n.t("timeline:titles.pitchedNoCompany", { person, role })
        : i18n.t("timeline:titles.pitched", { person, role, company });
    case "role-added":
      if (role == null) break;
      return company == null
        ? i18n.t("timeline:titles.roleAddedNoCompany", { role })
        : i18n.t("timeline:titles.roleAdded", { role, company });
    case "role-passed":
      if (role == null) break;
      return company == null
        ? i18n.t("timeline:titles.rolePassedNoCompany", { role })
        : i18n.t("timeline:titles.rolePassed", { role, company });
    case "company":
      if (company == null) break;
      return i18n.t("timeline:titles.company", { company });
    case "agency":
      if (agency == null) break;
      return i18n.t("timeline:titles.agency", { agency });
    case "contact":
      if (person == null) break;
      return i18n.t("timeline:titles.contact", { person });
    case "contact-waiting":
      if (person == null) break;
      return i18n.t("timeline:titles.contactWaiting", { person });
    case "contact-chased":
      if (person == null) break;
      return i18n.t("timeline:titles.contactChased", { person });
    case "contact-to-read":
      if (person == null) break;
      return i18n.t("timeline:titles.contactToRead", { person });
  }
  return item.title;
}
