import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";

import type { WorkflowStage } from "../api/hooks";
import { stageName } from "../utils/stageName";

export function StageBadge({
  id,
  stage,
  fallback,
}: {
  id: string;
  stage: WorkflowStage | undefined;
  fallback: string;
}) {
  useTranslation("stages"); // stageName reads i18n directly: this redraws it when the language changes
  return (
    <Badge
      color={stage?.color ?? "gray"}
      variant={stage?.kind === "active" ? "light" : "outline"}
      radius="sm"
    >
      {stageName({ id, name: stage?.name ?? fallback })}
    </Badge>
  );
}
