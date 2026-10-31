import type { TimelineItem } from "../api/timelineHooks";
import { i18n } from "../i18n";
import { callLabel } from "../utils/calls";
import { formatMoney } from "../utils/format";
import { roundLabel } from "../utils/rounds";

/**
 * What a Timeline entry is called, in your language. Other events (a summary's first line, or their kind:
 * i18n-events-activity) and every entry from an older server show the API's English `title`. So does
 * anything the sentence can't be whole without: a missing name or field, or a state it has no text for.
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
    case "contact-closed":
      if (person == null) break;
      if (item.closed_as === "ghosted") return i18n.t("timeline:titles.contactGhosted", { person });
      if (item.closed_as === "not_interested") {
        return i18n.t("timeline:titles.contactNotInterested", { person });
      }
      break;
    case "stage-event": {
      const move = item.stage_move;
      if (move?.to_name == null) break;
      return move.from_name == null
        ? i18n.t("timeline:titles.stageAdded", { stage: move.to_name })
        : i18n.t("timeline:titles.stageMoved", { from: move.from_name, to: move.to_name });
    }
    case "interview": {
      const r = item.round;
      if (r == null || !(r.title || r.kind)) break;
      if (r.status === "booked") return i18n.t("timeline:titles.roundBooked", { label: roundLabel(r) });
      if (r.status === "due") return i18n.t("timeline:titles.roundDue", { label: roundLabel(r) });
      if (r.status === "done") return i18n.t("timeline:titles.roundDone", { label: roundLabel(r) });
      break;
    }
    case "offer-reply": {
      const o = item.offer;
      if (o?.per === "none") return i18n.t("timeline:titles.offerReplyNoFigures");
      if (o?.amount == null) break;
      const money = formatMoney(o.amount, o.currency, i18n.language);
      if (o.per === "year") return i18n.t("timeline:titles.offerReplyYear", { money });
      if (o.per === "day") return i18n.t("timeline:titles.offerReplyDay", { money });
      break;
    }
    case "meeting": {
      const c = item.call;
      if (c?.kind == null || c.contact_name == null) break;
      if (c.status === "booked") return i18n.t("timeline:titles.callBooked", { label: callLabel(c) });
      if (c.status === "done") return i18n.t("timeline:titles.callDone", { label: callLabel(c) });
      break;
    }
    case "note":
      if (item.note_title == null) break;
      return i18n.t("timeline:titles.note", { note: item.note_title });
  }
  return item.title;
}
