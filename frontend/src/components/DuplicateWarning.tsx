import { Alert, Anchor, List, Text } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Duplicate } from "../api/client";
import { formatDate } from "../utils/time";

type T = ReturnType<typeof useTranslation>["t"];

function via(d: Duplicate, t: T): string {
  if (d.route === "agency") {
    const name = d.agency_name ?? d.recruiter_name;
    return name ? t("duplicates.via", { name }) : t("duplicates.viaRecruiter");
  }
  if (d.route === "referral") return t("duplicates.byReferral");
  return t("duplicates.directly");
}

function describe(d: Duplicate, t: T): string {
  const how = d.applied_on
    ? t("duplicates.howOn", {
        how: via(d, t),
        date: formatDate(d.applied_on),
      })
    : via(d, t);
  const bits = [how, t("duplicates.now", { stage: d.stage_name })];
  if (d.archived) bits.push(t("duplicates.archived"));
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
  const { t } = useTranslation();
  if (!duplicates.length) return null;
  return (
    <Alert color="yellow" variant="light" icon={<IconCopy size={18} />} title={title}>
      <List size="sm" spacing={2}>
        {duplicates.map((d) => (
          <List.Item key={d.id}>
            <Anchor component={Link} to={`/applications/${d.id}`} size="sm" onClick={onNavigate}>
              {t("duplicates.roleAt", {
                role: d.role_title,
                company: d.company_name,
              })}
            </Anchor>{" "}
            <Text span size="sm" c="dimmed">
              {describe(d, t)}
              {d.match === "similar_title" ? ` · ${t("duplicates.similarTitle")}` : ""}
            </Text>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}
