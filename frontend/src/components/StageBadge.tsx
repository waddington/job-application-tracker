import { Badge } from "@mantine/core";

import type { WorkflowStage } from "../api/hooks";

export function StageBadge({ stage, fallback }: { stage: WorkflowStage | undefined; fallback: string }) {
  return (
    <Badge
      color={stage?.color ?? "gray"}
      variant={stage?.kind === "active" ? "light" : "outline"}
      radius="sm"
    >
      {stage?.name ?? fallback}
    </Badge>
  );
}
