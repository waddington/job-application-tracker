import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState, type FormEvent } from "react";

import { useAgencies, useApplications, useCompanies, useContacts } from "../api/hooks";
import { useRoleSummaries } from "../api/roleHooks";
import {
  todoPath,
  useAddTodo,
  useDeleteTodo,
  useTodos,
  useUpdateTodo,
  type Todo,
  type TodoAbout,
} from "../api/todoHooks";
import { formatDate } from "../utils/time";

/** "Overdue", "Today", "Tomorrow" or "By 5 Oct 2026", and how loudly to say it. */
export function dueLabel(due: string, today: string): { label: string; color: string } {
  const days = dayjs(due).diff(dayjs(today), "day");
  if (days < 0) return { label: `Overdue · ${formatDate(due)}`, color: "red" };
  if (days === 0) return { label: "Today", color: "orange" };
  if (days === 1) return { label: "Tomorrow", color: "yellow" };
  return { label: `By ${formatDate(due)}`, color: "gray" };
}

/** One to-do: tick it off, see what it's about and when it's due, edit or delete it. */
export function TodoLine({ todo, showAbout = true }: { todo: Todo; showAbout?: boolean }) {
  const [today] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.text);
  const [due, setDue] = useState<string | null>(todo.due_on);
  const update = useUpdateTodo();
  const remove = useDeleteTodo();
  const done = todo.done_at != null;
  const path = todoPath(todo);
  const when = todo.due_on && !done ? dueLabel(todo.due_on, today) : null;

  const save = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim()) return;
    update.mutate(
      { id: todo.id, body: { text: text.trim(), due_on: due } },
      { onSuccess: () => setEditing(false) },
    );
  };

  if (editing)
    return (
      <form onSubmit={save}>
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <TextInput
            size="xs"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            aria-label="What needs doing"
            maxLength={500}
            style={{ flex: 1 }}
            autoFocus
          />
          <DateInput
            size="xs"
            value={due}
            onChange={setDue}
            clearable
            placeholder="No date"
            aria-label="Due"
            w={130}
          />
          <ActionIcon
            type="submit"
            variant="subtle"
            color="teal"
            loading={update.isPending}
            aria-label="Save to-do"
          >
            <IconCheck size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" onClick={() => setEditing(false)} aria-label="Cancel">
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </form>
    );

  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
      <Group gap="xs" wrap="nowrap" align="flex-start" style={{ minWidth: 0, flex: 1 }}>
        <Checkbox
          mt={2}
          checked={done}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ id: todo.id, body: { done: e.currentTarget.checked } })}
          aria-label={`${done ? "Not done" : "Done"}: ${todo.text}`}
        />
        <div style={{ minWidth: 0 }}>
          <Text size="sm" td={done ? "line-through" : undefined} c={done ? "dimmed" : undefined}>
            {todo.text}
          </Text>
          {(when || (showAbout && todo.about)) && (
            <Group gap={6}>
              {when && (
                <Badge size="xs" variant="light" color={when.color}>
                  {when.label}
                </Badge>
              )}
              {showAbout && todo.about && path && (
                <Anchor component={Link} to={path} size="xs" c="dimmed">
                  {todo.about}
                </Anchor>
              )}
            </Group>
          )}
        </div>
      </Group>
      <Group gap={2} wrap="nowrap">
        {!done && (
          <Tooltip label="Edit">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => {
                setText(todo.text);
                setDue(todo.due_on);
                setEditing(true);
              }}
              aria-label={`Edit to-do: ${todo.text}`}
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label="Delete">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            loading={remove.isPending}
            onClick={() => remove.mutate(todo.id)}
            aria-label={`Delete to-do: ${todo.text}`}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

/** Everything a to-do can be about, grouped, as "type:id" options. */
function useAboutOptions() {
  const { data: contacts } = useContacts();
  const { data: companies } = useCompanies();
  const { data: agencies } = useAgencies();
  const { data: roles } = useRoleSummaries({});
  const { data: applications } = useApplications({});
  const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
  return [
    {
      group: "Applications",
      items: (applications ?? [])
        .filter((a) => !a.archived)
        .map((a) => ({ value: `application:${a.id}`, label: `${a.company_name} · ${a.role_title}` }))
        .sort(byName),
    },
    {
      group: "Roles to decide",
      items: (roles ?? [])
        .filter((r) => r.status === "to_decide")
        .map((r) => ({ value: `role:${r.id}`, label: `${r.title} at ${r.company_name}` }))
        .sort(byName),
    },
    {
      group: "People",
      items: (contacts ?? []).map((c) => ({ value: `contact:${c.id}`, label: c.name })).sort(byName),
    },
    {
      group: "Companies",
      items: (companies ?? []).map((c) => ({ value: `company:${c.id}`, label: c.name })).sort(byName),
    },
    {
      group: "Agencies",
      items: (agencies ?? []).map((a) => ({ value: `agency:${a.id}`, label: a.name })).sort(byName),
    },
  ].filter((g) => g.items.length);
}

function AboutSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const options = useAboutOptions();
  return (
    <Select
      size="xs"
      data={options}
      value={value}
      onChange={onChange}
      searchable
      clearable
      placeholder="About (optional)"
      aria-label="About"
      nothingFoundMessage="Nothing by that name"
      style={{ flex: 1 }}
      miw={160}
    />
  );
}

/**
 * Add a to-do: about `about` when given (a person's page, a role), or with a picker for what
 * it's about (Next actions).
 */
export function AddTodo({
  about,
  autoFocus,
  onAdded,
}: {
  about?: { type: TodoAbout; id: string };
  autoFocus?: boolean;
  onAdded?: () => void;
}) {
  const add = useAddTodo();
  const [text, setText] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const [type, id] = about ? [about.type, about.id] : (picked?.split(":") ?? [null, null]);
    add.mutate(
      {
        text: text.trim(),
        due_on: due,
        entity_type: (type as TodoAbout | null) ?? null,
        entity_id: id ?? null,
      },
      {
        onSuccess: () => {
          setText("");
          setDue(null);
          setPicked(null);
          onAdded?.();
        },
      },
    );
  };
  return (
    <form onSubmit={submit}>
      <Group gap="xs" align="flex-start" wrap="wrap">
        <TextInput
          size="xs"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="Reply to their message, look into the company…"
          aria-label="New to-do"
          maxLength={500}
          style={{ flex: 3 }}
          miw={200}
          autoFocus={autoFocus}
        />
        {!about && <AboutSelect value={picked} onChange={setPicked} />}
        <DateInput
          size="xs"
          value={due}
          onChange={setDue}
          clearable
          placeholder="By (optional)"
          aria-label="Due (optional)"
          w={130}
        />
        <Button size="xs" type="submit" variant="light" loading={add.isPending} disabled={!text.trim()}>
          Add
        </Button>
      </Group>
    </form>
  );
}

/** To-dos about one thing, for its page: the open ones, the last few done, and a box to add one. */
export function TodosCard({ entityType, entityId }: { entityType: TodoAbout; entityId: string }) {
  const { data: todos } = useTodos({ entity_type: entityType, entity_id: entityId, status: "all" });
  const open = (todos ?? []).filter((t) => !t.done_at);
  const done = (todos ?? []).filter((t) => t.done_at).slice(0, 3);
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group gap="xs">
          <Title order={4}>To-dos</Title>
          {open.length > 0 && <Badge variant="light">{open.length}</Badge>}
        </Group>
        {open.map((t) => (
          <TodoLine key={t.id} todo={t} showAbout={false} />
        ))}
        {todos && !open.length && (
          <Text size="sm" c="dimmed">
            Nothing to do here. Add a reminder in your own words; it shows in Next actions until you tick it
            off.
          </Text>
        )}
        {done.map((t) => (
          <TodoLine key={t.id} todo={t} showAbout={false} />
        ))}
        <AddTodo about={{ type: entityType, id: entityId }} />
      </Stack>
    </Card>
  );
}
