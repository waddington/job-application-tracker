import type { TimelineItem } from "../api/timelineHooks";
import { i18n } from "../i18n";
import { callLabel } from "../utils/calls";
import { eventText } from "./eventText";
import { formatMoney } from "../utils/format";
import { roundLabel } from "../utils/rounds";
import { stageName } from "../utils/stageName";

// What api/timeline.py splits a summary on. Python's splitlines and strip each know characters JavaScript's
// don't, so these are spelled out: the two must agree (timelineEvents.cases.json).
// eslint-disable-next-line no-control-regex
const PY_LINE_BREAK = new RegExp("\\r\\n|[\\n\\r\\u000b\\u000c\\u001c\\u001d\\u001e\\u0085\\u2028\\u2029]");
const PY_SPACE =
  "[\\t\\n\\u000b\\u000c\\r\\u001c-\\u001f \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+";
const PY_STRIP = new RegExp(`^${PY_SPACE}|${PY_SPACE}$`, "g");

const BARE_KINDS = {
  call: "timeline:titles.bareCall",
  email: "timeline:titles.bareEmail",
  message: "timeline:titles.bareMessage",
  note: "timeline:titles.bareNote",
  file: "timeline:titles.bareFile",
  interview: "timeline:titles.bareInterview",
  manual: "timeline:titles.bareManual",
} as const;

/** An other event's words, from its message: the English is its title line, then the rest. */
function otherEventTitle(item: TimelineItem): string {
  if (item.bare_kind && Object.hasOwn(BARE_KINDS, item.bare_kind)) {
    return i18n.t(BARE_KINDS[item.bare_kind as keyof typeof BARE_KINDS]);
  }
  const text = eventText({ summary: null, msg: item.msg });
  return text == null ? item.title : (text.split(PY_LINE_BREAK)[0] ?? "");
}

/** The line under a Timeline entry's title: `_detail` in api/timeline.py, built from the message if it has one. */
export function timelineDetail(item: TimelineItem): string | null {
  const text = eventText({ summary: null, msg: item.msg });
  if (text == null) return item.detail ?? null;
  if (item.kind === "stage-event") return item.detail == null ? null : text; // the whole of a move's note
  const start = text.indexOf("\n");
  if (start === -1) return null;
  return text.slice(start + 1).replace(PY_STRIP, "") || null;
}

/**
 * What a Timeline entry is called, in your language. An old event or your own words (a summary's first
 * line) and every entry from an older server show the API's English `title`. So does anything the
 * sentence can't be whole without: a missing name or field, or a state it has no text for.
 */
export function timelineTitle(item: TimelineItem): string {
  const person = item.people[0]?.name;
  const role = item.role_title;
  const company = item.company_name;
  const agency = item.agency_name;
  switch (item.kind) {
    case "other-event":
      return otherEventTitle(item);
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
      const to = stageName({ id: move.to_stage, name: move.to_name });
      return move.from_name == null
        ? i18n.t("timeline:titles.stageAdded", { stage: to })
        : i18n.t("timeline:titles.stageMoved", {
            from: stageName({ id: move.from_stage, name: move.from_name }),
            to,
          });
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
