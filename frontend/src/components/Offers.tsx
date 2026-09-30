import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconCash, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useState } from "react";

import {
  headline,
  money,
  STATUS_LABELS,
  useDeleteOffer,
  useOffers,
  useSaveOffer,
  type Offer,
  type OfferBody,
  type OfferStatus,
} from "../api/offerHooks";
import { useRoles } from "../api/hooks";
import { formatDate } from "../utils/time";

type Kind = "permanent" | "contract" | "fixed_term";
type Num = number | string;

interface Values {
  status: OfferStatus;
  employmentType: Kind;
  currency: string;
  salary: Num;
  bonus: Num;
  equity: string;
  equityValue: Num;
  pensionPercent: Num;
  holidayDays: Num;
  dayRate: Num;
  ir35: "inside" | "outside" | "unknown" | null;
  contractMonths: Num;
  receivedOn: string | null;
  respondBy: string | null;
  startOn: string | null;
  benefits: string;
  notes: string;
}

const num = (v: Num) => (v === "" || v == null ? null : Number(v));
const blank = (s: string) => s.trim() || null;
const day = (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD") : null);

function fromOffer(o: Offer | null, defaultKind: Kind): Values {
  return {
    status: o?.status ?? "pending",
    employmentType: (o?.employment_type as Kind | null) ?? defaultKind,
    currency: o?.currency ?? "GBP",
    salary: o?.salary ?? "",
    bonus: o?.bonus ?? "",
    equity: o?.equity ?? "",
    equityValue: o?.equity_value ?? "",
    pensionPercent: o?.pension_percent ?? "",
    holidayDays: o?.holiday_days ?? "",
    dayRate: o?.day_rate ?? "",
    ir35: (o?.ir35 as Values["ir35"]) ?? null,
    contractMonths: o?.contract_months ?? "",
    receivedOn: o?.received_on ?? dayjs().format("YYYY-MM-DD"),
    respondBy: o?.respond_by ?? null,
    startOn: o?.start_on ?? null,
    benefits: o?.benefits ?? "",
    notes: o?.notes ?? "",
  };
}

/** Add or edit an offer. Mount it with a `key` per offer so the form starts fresh. */
export function OfferFormModal({
  opened,
  onClose,
  applicationId,
  offer,
  defaultKind = "permanent",
}: {
  opened: boolean;
  onClose: () => void;
  applicationId: string;
  offer: Offer | null;
  defaultKind?: Kind;
}) {
  const save = useSaveOffer();
  const form = useForm<Values>({
    initialValues: fromOffer(offer, defaultKind),
    validate: { currency: (v) => (!v || /^[A-Za-z]{3}$/.test(v) ? null : "Three letters, like GBP") },
  });
  const contract = form.values.employmentType === "contract";

  const submit = form.onSubmit((v) => {
    const body: OfferBody = {
      status: v.status,
      employment_type: v.employmentType,
      currency: blank(v.currency)?.toUpperCase() ?? null,
      // A contract is a day rate; a permanent or fixed-term job is a salary package.
      salary: contract ? null : num(v.salary),
      bonus: contract ? null : num(v.bonus),
      equity: contract ? null : blank(v.equity),
      equity_value: contract ? null : num(v.equityValue),
      pension_percent: contract ? null : num(v.pensionPercent),
      holiday_days: contract ? null : num(v.holidayDays),
      day_rate: contract ? num(v.dayRate) : null,
      ir35: contract ? v.ir35 : null,
      contract_months: contract || v.employmentType === "fixed_term" ? num(v.contractMonths) : null,
      received_on: day(v.receivedOn),
      respond_by: day(v.respondBy),
      start_on: day(v.startOn),
      benefits: blank(v.benefits),
      notes: blank(v.notes),
    };
    save.mutate(offer ? { id: offer.id, body } : { applicationId, body }, { onSuccess: onClose });
  });

  return (
    <Modal opened={opened} onClose={onClose} title={offer ? "Edit offer" : "Add an offer"} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Group grow align="flex-end">
            <SegmentedControl
              aria-label="Kind"
              data={[
                { value: "permanent", label: "Permanent" },
                { value: "contract", label: "Contract" },
                { value: "fixed_term", label: "Fixed term" },
              ]}
              {...form.getInputProps("employmentType")}
            />
            <Select
              label="Status"
              allowDeselect={false}
              data={Object.entries(STATUS_LABELS).map(([value, s]) => ({ value, label: s.label }))}
              {...form.getInputProps("status")}
            />
          </Group>
          {contract ? (
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <NumberInput
                label="Day rate"
                min={0}
                thousandSeparator=","
                data-autofocus
                {...form.getInputProps("dayRate")}
              />
              <Select
                label="IR35"
                placeholder="Not set"
                clearable
                data={[
                  { value: "outside", label: "Outside" },
                  { value: "inside", label: "Inside" },
                  { value: "unknown", label: "Unknown" },
                ]}
                {...form.getInputProps("ir35")}
              />
              <NumberInput
                label="Length (months)"
                min={0}
                max={120}
                {...form.getInputProps("contractMonths")}
              />
            </SimpleGrid>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <NumberInput
                  label="Base salary"
                  min={0}
                  thousandSeparator=","
                  data-autofocus
                  {...form.getInputProps("salary")}
                />
                <NumberInput
                  label="Bonus (expected, a year)"
                  min={0}
                  thousandSeparator=","
                  {...form.getInputProps("bonus")}
                />
                <NumberInput
                  label="Employer pension (%)"
                  min={0}
                  max={100}
                  decimalScale={1}
                  {...form.getInputProps("pensionPercent")}
                />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <TextInput
                  label="Equity"
                  placeholder="0.1% over 4 years, 1-year cliff"
                  {...form.getInputProps("equity")}
                />
                <NumberInput
                  label="Equity worth (a year)"
                  description="Your estimate"
                  min={0}
                  thousandSeparator=","
                  {...form.getInputProps("equityValue")}
                />
                <NumberInput
                  label="Holiday (days)"
                  min={0}
                  max={366}
                  {...form.getInputProps("holidayDays")}
                />
              </SimpleGrid>
              {form.values.employmentType === "fixed_term" && (
                <NumberInput
                  label="Length (months)"
                  min={0}
                  max={120}
                  {...form.getInputProps("contractMonths")}
                />
              )}
            </>
          )}
          <SimpleGrid cols={{ base: 1, sm: 4 }}>
            <TextInput label="Currency" maxLength={3} {...form.getInputProps("currency")} />
            <DateInput label="Received" clearable {...form.getInputProps("receivedOn")} />
            <DateInput label="Reply by" clearable {...form.getInputProps("respondBy")} />
            <DateInput label="Start date" clearable {...form.getInputProps("startOn")} />
          </SimpleGrid>
          <Textarea
            label="Benefits"
            autosize
            minRows={2}
            placeholder="Private health, £1k learning budget…"
            {...form.getInputProps("benefits")}
          />
          <Textarea label="Notes" autosize minRows={2} {...form.getInputProps("notes")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {offer ? "Save offer" : "Add offer"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** One line per figure that's set: "Bonus £8,000", "Pension 6%"… */
export function offerFacts(o: Offer): string[] {
  const facts: string[] = [];
  if (o.value_basis === "day rate") {
    if (o.ir35) facts.push(`IR35 ${o.ir35}`);
  } else {
    if (o.bonus) facts.push(`Bonus ${money(o.bonus, o.currency)}`);
    if (o.pension_percent != null) facts.push(`Pension ${o.pension_percent}%`);
    if (o.equity) facts.push(`Equity: ${o.equity}`);
    if (o.holiday_days != null) facts.push(`${o.holiday_days} days' holiday`);
  }
  if (o.contract_months) facts.push(`${o.contract_months} months`);
  if (o.start_on) facts.push(`Starts ${formatDate(o.start_on)}`);
  return facts;
}

/** Offers on an application, newest first; a revised offer goes on top. */
export function OffersCard({ applicationId, roleId }: { applicationId: string; roleId: string }) {
  const { data: offers } = useOffers({ application_id: applicationId, latest: false });
  const { data: roles } = useRoles();
  // A new offer starts as the kind of job the role is.
  const defaultKind = (roles?.find((r) => r.id === roleId)?.employment_type as Kind | null) ?? "permanent";
  const remove = useDeleteOffer();
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconCash size={20} stroke={1.6} />
          <Title order={4}>Offer</Title>
        </Group>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setEditing("new")}
        >
          {offers?.length ? "Add a revised offer" : "Add offer"}
        </Button>
      </Group>
      {!offers?.length ? (
        <Text size="sm" c="dimmed">
          No offer yet. When one comes in, add its pay and terms to compare it with others.
        </Text>
      ) : (
        <Stack gap="sm">
          {offers.map((o, i) => (
            <Card key={o.id} withBorder padding="sm" opacity={i === 0 ? 1 : 0.6}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600}>{headline(o)}</Text>
                    <Badge size="sm" variant="light" color={STATUS_LABELS[o.status].color}>
                      {STATUS_LABELS[o.status].label}
                    </Badge>
                    {i > 0 && (
                      <Badge size="sm" variant="outline" color="gray">
                        Earlier offer
                      </Badge>
                    )}
                  </Group>
                  {o.annual_value != null && o.value_basis === "salary" && (
                    <Text size="sm">Worth about {money(o.annual_value, o.currency)} a year in total</Text>
                  )}
                  {o.annual_value != null && o.value_basis === "day rate" && (
                    <Text size="sm">
                      About {money(o.annual_value, o.currency)} a year at 220 working days
                    </Text>
                  )}
                  {offerFacts(o).length > 0 && (
                    <Text size="xs" c="dimmed">
                      {offerFacts(o).join(" · ")}
                    </Text>
                  )}
                  {o.respond_by && o.status === "pending" && (
                    <Text size="xs" c="orange">
                      Reply by {formatDate(o.respond_by)}
                    </Text>
                  )}
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon variant="subtle" aria-label="Edit offer" onClick={() => setEditing(o)}>
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Delete offer"
                    onClick={() => {
                      if (window.confirm("Delete this offer?")) remove.mutate(o.id);
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {editing && (
        <OfferFormModal
          key={editing === "new" ? "new" : editing.id}
          opened
          onClose={() => setEditing(null)}
          applicationId={applicationId}
          offer={editing === "new" ? null : editing}
          defaultKind={defaultKind}
        />
      )}
    </Card>
  );
}
