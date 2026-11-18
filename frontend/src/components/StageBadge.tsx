import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { WorkflowStage } from "../api/hooks";
import { stageName } from "../utils/stageName";

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
   * Never cut the name short. In a table the badge would otherwise give way first (it hides its overflow, so a
   * cell can squeeze it to nothing): "Interviewing" became "INTERVIE…" beside a long role name.
   */
  whole?: boolean;
}) {
  useTranslation("stages"); // stageName reads i18n directly: this redraws it when the language changes
  return (
    <Badge
      color={stage?.color ?? "gray"}
      variant={stage?.kind === "active" ? "light" : "outline"}
      miw={whole ? "max-content" : undefined}
    >
      {stageName({ id, name: stage?.name ?? fallback })}
    </Badge>
  );
}
