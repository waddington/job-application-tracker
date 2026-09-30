import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";

import { useDeleteEntity, type Deletable } from "../api/deleteHooks";

/**
 * Delete an application, company, agency, person or role after a confirmation that says what
 * goes with it. `onDeleted` runs afterwards (e.g. leave the page that no longer exists).
 * If the server refuses (a company that still has applications), its reason is shown.
 */
export function DeleteButton({
  kind,
  id,
  name,
  confirm,
  onDeleted,
  blocked,
  compact = false,
}: {
  kind: Deletable;
  id: string;
  name: string;
  confirm: string;
  onDeleted?: () => void;
  /** Why it can't be deleted yet, if it can't: shown instead of the confirmation. */
  blocked?: string | null;
  compact?: boolean;
}) {
  const remove = useDeleteEntity(kind, onDeleted);
  const label = `Delete ${name}`;
  const run = () => {
    if (blocked) window.alert(blocked);
    else if (window.confirm(confirm)) remove.mutate(id);
  };
  return compact ? (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="red" aria-label={label} loading={remove.isPending} onClick={run}>
        <IconTrash size={16} />
      </ActionIcon>
    </Tooltip>
  ) : (
    <Button
      variant="subtle"
      color="red"
      size="xs"
      leftSection={<IconTrash size={14} />}
      loading={remove.isPending}
      onClick={run}
    >
      Delete
    </Button>
  );
}
