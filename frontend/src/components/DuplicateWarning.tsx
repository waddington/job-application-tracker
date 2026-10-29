import { Alert, Anchor, List, Text } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { Duplicate } from "../api/client";
import { shadow } from "../i18n/shadow";
import { formatDate } from "../utils/time";

function via(d: Duplicate): string {
  if (d.route === "agency") {
    const name = d.agency_name ?? d.recruiter_name;
    return name
      ? shadow("common:duplicates.via", `via ${name}`, { name })
      : shadow("common:duplicates.viaRecruiter", "via a recruiter");
  }
  if (d.route === "referral") return shadow("common:duplicates.byReferral", "by referral");
  return shadow("common:duplicates.directly", "directly");
}

function describe(d: Duplicate): string {
  const how = d.applied_on
    ? shadow("common:duplicates.howOn", `${via(d)} on ${formatDate(d.applied_on)}`, {
        how: via(d),
        date: formatDate(d.applied_on),
      })
    : via(d);
  const bits = [how, shadow("common:duplicates.now", `now ${d.stage_name}`, { stage: d.stage_name })];
  if (d.archived) bits.push(shadow("common:duplicates.archived", "archived"));
  return bits.join(" · ");
}

/**
 * Other applications that look like the same job. Shown while adding an application ("have you
 * applied already?") and on an application's page ("also applied via…").
 */
export function DuplicateWarning({
  duplicates,
  title,
  onNavigate,
}: {
  duplicates: Duplicate[];
  title: string;
  onNavigate?: () => void;
}) {
  if (!duplicates.length) return null;
  return (
    <Alert color="yellow" variant="light" icon={<IconCopy size={18} />} title={title}>
      <List size="sm" spacing={2}>
        {duplicates.map((d) => (
          <List.Item key={d.id}>
            <Anchor component={Link} to={`/applications/${d.id}`} size="sm" onClick={onNavigate}>
              {shadow("common:duplicates.roleAt", `${d.role_title} at ${d.company_name}`, {
                role: d.role_title,
                company: d.company_name,
              })}
            </Anchor>{" "}
            <Text span size="sm" c="dimmed">
              {describe(d)}
              {d.match === "similar_title"
                ? ` · ${shadow("common:duplicates.similarTitle", "similar title")}`
                : ""}
            </Text>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}
