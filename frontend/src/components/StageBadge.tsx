import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { WorkflowStage } from "../api/hooks";
import { stageName } from "../utils/stageName";

/** A badge that wraps rather than cutting its name short, and is never narrower than its longest word. */
const WHOLE = {
  root: { height: "auto", minWidth: "min-content", paddingBlock: 2 },
  label: { whiteSpace: "normal", overflow: "visible", textOverflow: "clip", lineHeight: 1.35 },
} as const;

export function StageBadge({
  id,
  stage,
  fallback,
  whole = false,
}: {
  id: string;
  stage: WorkflowStage | undefined;
  fallback: string;
  /**
   * Never cut the name short: a long one wraps, the badge growing taller. In a table the badge would otherwise
   * give way first (it hides its overflow, so a cell can squeeze it to nothing: "Interviewing" became "INTERVIE…"
   * beside a long role name), and holding it to one line would push a renamed stage's table out of its card.
   */
  whole?: boolean;
}) {
  useTranslation("stages"); // stageName reads i18n directly: this redraws it when the language changes
  return (
    <Badge
      color={stage?.color ?? "gray"}
      variant={stage?.kind === "active" ? "light" : "outline"}
      styles={whole ? WHOLE : undefined}
    >
      {stageName({ id, name: stage?.name ?? fallback })}
    </Badge>
  );
}
