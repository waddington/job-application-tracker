import { Alert, Anchor, List, Text } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";

import type { Duplicate } from "../api/client";

function via(d: Duplicate): string {
  if (d.route === "agency") return `via ${d.agency_name ?? d.recruiter_name ?? "a recruiter"}`;
  if (d.route === "referral") return "by referral";
  return "directly";
}

function describe(d: Duplicate): string {
  const how = d.applied_on ? `${via(d)} on ${dayjs(d.applied_on).format("D MMM YYYY")}` : via(d);
  const bits = [how, `now ${d.stage_name}`];
  if (d.archived) bits.push("archived");
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
              {d.role_title} at {d.company_name}
            </Anchor>{" "}
            <Text span size="sm" c="dimmed">
              {describe(d)}
              {d.match === "similar_title" ? " · similar title" : ""}
            </Text>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}
