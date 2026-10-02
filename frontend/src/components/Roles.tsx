import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconListCheck, IconPencil, IconPlus } from "@tabler/icons-react";
import { Link, useRouter } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";

import { useContacts, useCompanies, useWorkflow } from "../api/hooks";
import { useTodos } from "../api/todoHooks";
import { useCreateCompany } from "../api/detailHooks";
import { useMeetings } from "../api/meetingHooks";
import {
  ROLE_STATUS,
  useApplyForRole,
  useRoleSummaries,
  useSaveRole,
  type RoleFilters,
  type RoleSummary,
} from "../api/roleHooks";
import type { Schemas } from "../api/client";
import { CreatableSelect } from "./CreatableSelect";
import { DeleteButton } from "./DeleteButton";
import { AddTodo, TodoLine } from "./Todos";

type WorkMode = NonNullable<Schemas["RoleIn"]["work_mode"]>;
type Employment = NonNullable<Schemas["RoleIn"]["employment_type"]>;
type IR35 = NonNullable<Schemas["RoleIn"]["ir35"]>;

interface Values {
  companyId: string | null;
  title: string;
  url: string;
  location: string;
  workMode: WorkMode | null;
  employment: Employment | null;
  salaryMin: number | string;
  salaryMax: number | string;
  dayRate: number | string;
  ir35: IR35 | null;
  contactId: string | null;
  meetingId: string | null;
  description: string;
}

const blank = (s: string) => s.trim() || null;
const num = (v: number | string) => (v === "" || v == null ? null : Number(v));
const isLink = (v: string) => (!v || /^https?:\/\//.test(v) ? null : "Links start with http:// or https://");

/** "£600 a day", "£80k–£95k": what it pays, if you know. */
export function pay(role: RoleSummary): string | null {
  const k = (n: number) => (n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`);
  if (role.day_rate)
    return `£${role.day_rate} a day${role.ir35 && role.ir35 !== "unknown" ? `, ${role.ir35} IR35` : ""}`;
  if (role.salary_min && role.salary_max) return `${k(role.salary_min)}–${k(role.salary_max)}`;
  if (role.salary_min ?? role.salary_max) return k((role.salary_min ?? role.salary_max)!);
  return null;
}

/**
 * Add a role you might go for: one a recruiter pitched on a call, or one you spotted. Pass
 * `contactId`/`meetingId`/`companyId` to start from a person, a call or a company.
 */
export function RoleFormModal({
  opened,
  onClose,
  role,
  contactId,
  meetingId,
  companyId,
}: {
  opened: boolean;
  onClose: () => void;
  /** Edit this role instead of adding one. */
  role?: RoleSummary;
  contactId?: string;
  meetingId?: string;
  companyId?: string;
}) {
  const { data: companies } = useCompanies();
  const { data: contacts } = useContacts();
  const createCompany = useCreateCompany();
  const save = useSaveRole();
  const form = useForm<Values>({
    initialValues: {
      companyId: role?.company_id ?? companyId ?? null,
      title: role?.title ?? "",
      url: role?.url ?? "",
      location: role?.location ?? "",
      workMode: (role?.work_mode as WorkMode | null) ?? null,
      employment: (role?.employment_type as Employment | null) ?? null,
      salaryMin: role?.salary_min ?? "",
      salaryMax: role?.salary_max ?? "",
      dayRate: role?.day_rate ?? "",
      ir35: (role?.ir35 as IR35 | null) ?? null,
      contactId: role ? (role.contact_id ?? null) : (contactId ?? null),
      meetingId: role ? (role.meeting_id ?? null) : (meetingId ?? null),
      description: role?.description ?? "",
    },
    validate: {
      companyId: (v) => (v ? null : "Which company? Type a new name to add it."),
      title: (v) => (v.trim() ? null : "What's the role?"),
      url: isLink,
    },
  });
  const { data: theirCalls } = useMeetings(
    { contact_id: form.values.contactId ?? undefined },
    !!form.values.contactId,
  );
  const contract = form.values.employment === "contract";

  const submit = form.onSubmit((v, event) => {
    // Which button: "Add role" closes, "Add and add another" keeps the form open.
    const button = (event?.nativeEvent as SubmitEvent | undefined)?.submitter as
      HTMLElement | null | undefined;
    const another = button?.dataset.another === "yes";
    const body = {
      company_id: v.companyId!,
      title: v.title.trim(),
      url: blank(v.url),
      location: blank(v.location),
      work_mode: v.workMode,
      employment_type: v.employment,
      salary_min: contract ? null : num(v.salaryMin),
      salary_max: contract ? null : num(v.salaryMax),
      day_rate: contract ? num(v.dayRate) : null,
      ir35: contract ? v.ir35 : null,
      currency: "GBP",
      contact_id: v.contactId,
      meeting_id: v.contactId ? v.meetingId : null,
      description: blank(v.description),
    };
    save.mutate(role ? { id: role.id, body } : { body }, {
      onSuccess: () => {
        if (!another || role) return onClose();
        // Keep who and which call, clear the rest: the next role from the same call.
        form.setValues({
          title: "",
          url: "",
          location: "",
          salaryMin: "",
          salaryMax: "",
          dayRate: "",
          description: "",
        });
      },
    });
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={role ? `Edit ${role.title}` : "Add a role to decide on"}
      size="lg"
    >
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm" c="dimmed">
            A role you might go for. It waits under <b>Roles</b> until you apply or pass.
          </Text>
          <Group grow align="flex-start">
            <CreatableSelect
              label="Company"
              placeholder="Pick or type a new one"
              items={(companies ?? []).map((c) => ({ value: c.id, label: c.name }))}
              value={form.values.companyId}
              onChange={(v) => form.setFieldValue("companyId", v)}
              onCreate={async (name) => (await createCompany.mutateAsync({ name })).id}
              creating={createCompany.isPending}
              error={form.errors.companyId}
              data-autofocus
            />
            <TextInput label="Role" placeholder="Platform Engineer" {...form.getInputProps("title")} />
          </Group>
          <Group grow align="flex-start">
            <Select
              label="Who told you about it"
              placeholder="No one: you found it"
              searchable
              clearable
              data={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...form.getInputProps("contactId")}
              onChange={(v) => {
                form.setFieldValue("contactId", v);
                if (v !== form.values.contactId) form.setFieldValue("meetingId", null);
              }}
            />
            <Select
              label="On which call"
              placeholder={form.values.contactId ? "Not from a call" : "Pick who first"}
              clearable
              disabled={!form.values.contactId}
              data={(theirCalls ?? []).map((m) => ({
                value: m.id,
                label: `${m.title ?? m.label} · ${dayjs(m.starts_at).format("D MMM")}`,
              }))}
              {...form.getInputProps("meetingId")}
            />
          </Group>
          <TextInput label="Job ad link" placeholder="https://…" {...form.getInputProps("url")} />
          <Group grow align="flex-start">
            <TextInput label="Location" placeholder="London" {...form.getInputProps("location")} />
            <Select
              label="Work mode"
              clearable
              data={[
                { value: "remote", label: "Remote" },
                { value: "hybrid", label: "Hybrid" },
                { value: "office", label: "Office" },
              ]}
              {...form.getInputProps("workMode")}
            />
            <Select
              label="Type"
              clearable
              data={[
                { value: "permanent", label: "Permanent" },
                { value: "contract", label: "Contract" },
                { value: "fixed_term", label: "Fixed term" },
              ]}
              {...form.getInputProps("employment")}
            />
          </Group>
          {contract ? (
            <Group grow align="flex-start">
              <NumberInput
                label="Day rate (£)"
                min={0}
                thousandSeparator=","
                {...form.getInputProps("dayRate")}
              />
              <Select
                label="IR35"
                clearable
                data={[
                  { value: "outside", label: "Outside" },
                  { value: "inside", label: "Inside" },
                  { value: "unknown", label: "Not sure" },
                ]}
                {...form.getInputProps("ir35")}
              />
            </Group>
          ) : (
            <Group grow align="flex-start">
              <NumberInput
                label="Salary from (£)"
                min={0}
                thousandSeparator=","
                {...form.getInputProps("salaryMin")}
              />
              <NumberInput
                label="Salary to (£)"
                min={0}
                thousandSeparator=","
                {...form.getInputProps("salaryMax")}
              />
            </Group>
          )}
          <Textarea
            label="Notes"
            description="What they said about it: team, stack, why it's open."
            autosize
            minRows={2}
            {...form.getInputProps("description")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} style={{ order: 0 }}>
              Cancel
            </Button>
            {/* "Add role" first: pressing Enter submits with the first submit button. */}
            <Button type="submit" loading={save.isPending} style={{ order: 2 }}>
              {role ? "Save" : "Add role"}
            </Button>
            {!role && (
              <Button
                type="submit"
                variant="light"
                disabled={save.isPending}
                data-another="yes"
                style={{ order: 1 }}
              >
                Add and add another
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** Apply for a role: makes the application (through whoever pitched it) and opens it. */
export function ApplyModal({ role, onClose }: { role: RoleSummary; onClose: () => void }) {
  const { data: workflow } = useWorkflow();
  const apply = useApplyForRole();
  const router = useRouter();
  const [picked, setStage] = useState<string | null>(null);
  const [appliedOn, setAppliedOn] = useState<string | null>(dayjs().format("YYYY-MM-DD"));
  const how = role.agency_id
    ? `Through ${role.agency_name}${role.contact_name ? ` (${role.contact_name})` : ""}`
    : role.contact_name
      ? `Directly, with ${role.contact_name} as your contact`
      : "Directly";
  const hasApplied = workflow?.stages.some((s) => s.id === "applied");
  const stage = picked ?? (hasApplied ? "applied" : (workflow?.initial ?? null));

  const submit = () =>
    apply.mutate(
      {
        role_id: role.id,
        route: role.agency_id ? "agency" : "direct",
        agency_id: role.agency_id ?? null,
        recruiter_id: role.contact_id ?? null,
        stage: stage ?? undefined,
        applied_on: appliedOn,
        tags: [],
      },
      {
        onSuccess: (app) => {
          onClose();
          router.history.push(`/applications/${app.id}`);
        },
      },
    );

  return (
    <Modal opened onClose={onClose} title={`Apply: ${role.title} at ${role.company_name}`}>
      <Stack>
        <Text size="sm">{how}.</Text>
        <Group grow align="flex-start">
          <Select
            label="Stage"
            data={(workflow?.stages ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={stage}
            onChange={setStage}
            allowDeselect={false}
          />
          <DateInput
            label="Applied on"
            clearable
            value={appliedOn}
            onChange={setAppliedOn}
            placeholder="Not yet"
          />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={apply.isPending}>
            Create application
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Pass on a role, with an optional reason (it's kept, under Passed). */
export function PassModal({ role, onClose }: { role: RoleSummary; onClose: () => void }) {
  const save = useSaveRole();
  const [reason, setReason] = useState("");
  return (
    <Modal opened onClose={onClose} title={`Pass on ${role.title} at ${role.company_name}`}>
      <Stack>
        <Textarea
          label="Why? (optional)"
          placeholder="Office five days a week, too junior, rate too low…"
          autosize
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="gray"
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { id: role.id, body: { decision: "passed", decision_reason: reason.trim() || null } },
                { onSuccess: onClose },
              )
            }
          >
            Pass
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Apply / Pass for a role still to decide, Reconsider for one you passed, a link once applied. */
export function RoleActions({ role }: { role: RoleSummary }) {
  const [open, setOpen] = useState<"apply" | "pass" | null>(null);
  const save = useSaveRole();
  if (role.status === "applied")
    return (
      <Anchor component={Link} to={`/applications/${role.application_ids[0]}`} size="xs">
        Open application
      </Anchor>
    );
  return (
    <Group gap={4} wrap="nowrap">
      {role.status === "to_decide" ? (
        <>
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => setOpen("apply")}
            aria-label={`Apply: ${role.title}`}
          >
            Apply
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => setOpen("pass")}
            aria-label={`Pass: ${role.title}`}
          >
            Pass
          </Button>
        </>
      ) : (
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          loading={save.isPending}
          onClick={() => save.mutate({ id: role.id, body: { decision: null } })}
          aria-label={`Reconsider: ${role.title}`}
        >
          Reconsider
        </Button>
      )}
      {open === "apply" && <ApplyModal role={role} onClose={() => setOpen(null)} />}
      {open === "pass" && <PassModal role={role} onClose={() => setOpen(null)} />}
    </Group>
  );
}

/** One role: what, where, who pitched it, pay, status and what to do next. */
export function RoleLine({ role, showSource = true }: { role: RoleSummary; showSource?: boolean }) {
  const status = ROLE_STATUS[role.status];
  const money = pay(role);
  const [editing, setEditing] = useState(false);
  const [addingTodo, setAddingTodo] = useState(false);
  // All open to-dos, one shared request, picked out per role.
  const { data: openTodos } = useTodos();
  const todos = (openTodos ?? []).filter((t) => t.entity_type === "role" && t.entity_id === role.id);
  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm" truncate="end">
              {role.title}
            </Text>
            <Anchor component={Link} to={`/companies/${role.company_id}`} size="sm">
              {role.company_name}
            </Anchor>
          </Group>
          <Text size="xs" c="dimmed">
            {[
              money,
              role.work_mode,
              role.location,
              showSource && role.contact_name
                ? `from ${role.contact_name}${role.agency_name ? ` (${role.agency_name})` : ""}`
                : null,
              role.status === "passed" && role.decision_reason ? `passed: ${role.decision_reason}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </div>
        <Group gap="xs" wrap="nowrap">
          <Badge size="xs" variant="light" color={status.color}>
            {status.label}
          </Badge>
          <RoleActions role={role} />
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`Edit ${role.title}`}
            onClick={() => setEditing(true)}
          >
            <IconPencil size={14} />
          </ActionIcon>
          <Tooltip label="Add a to-do">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={`Add a to-do about ${role.title}`}
              onClick={() => setAddingTodo((v) => !v)}
            >
              <IconListCheck size={14} />
            </ActionIcon>
          </Tooltip>
          {editing && <RoleFormModal opened onClose={() => setEditing(false)} role={role} />}
          {role.status !== "applied" && (
            <DeleteButton
              compact
              kind="role"
              id={role.id}
              name={role.title}
              confirm={`Delete the role ${role.title} at ${role.company_name}? Passing on it keeps a record instead.`}
            />
          )}
        </Group>
      </Group>
      {(todos.length > 0 || addingTodo) && (
        <Stack gap={6} pl="md">
          {todos.map((t) => (
            <TodoLine key={t.id} todo={t} showAbout={false} />
          ))}
          {addingTodo && (
            <AddTodo about={{ type: "role", id: role.id }} autoFocus onAdded={() => setAddingTodo(false)} />
          )}
        </Stack>
      )}
    </Stack>
  );
}

/** Roles in a card, for a person's, call's or company's page, with "Add role" starting from it. */
export function RolesCard({
  title,
  filters,
  start,
  empty,
  showSource = true,
}: {
  title: string;
  filters: RoleFilters;
  start: { contactId?: string; meetingId?: string; companyId?: string };
  empty: string;
  showSource?: boolean;
}) {
  const { data: roles } = useRoleSummaries(filters);
  const [adding, setAdding] = useState(false);
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>{title}</Title>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setAdding(true)}
        >
          Add role
        </Button>
      </Group>
      {!roles?.length ? (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      ) : (
        <Stack gap="sm">
          {roles.map((r) => (
            <RoleLine key={r.id} role={r} showSource={showSource} />
          ))}
        </Stack>
      )}
      {adding && <RoleFormModal opened onClose={() => setAdding(false)} {...start} />}
    </Card>
  );
}
