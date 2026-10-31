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
import { useTranslation } from "react-i18next";

import {
  headline,
  money,
  OFFER_STATUS,
  useDeleteOffer,
  useOffers,
  useSaveOffer,
  type Offer,
  type OfferBody,
  type OfferStatus,
} from "../api/offerHooks";
import { useRoles } from "../api/hooks";
import { i18n } from "../i18n";
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
  const { t } = useTranslation(["offers", "common"]);
  const save = useSaveOffer();
  const form = useForm<Values>({
    initialValues: fromOffer(offer, defaultKind),
    validate: { currency: (v) => (!v || /^[A-Za-z]{3}$/.test(v) ? null : t("form.currencyError")) },
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={offer ? t("form.editTitle") : t("form.addTitle")}
      size="lg"
    >
      <form onSubmit={submit}>
        <Stack>
          <Group grow align="flex-end">
            <SegmentedControl
              aria-label={t("form.kind")}
              data={[
                { value: "permanent", label: t("form.kinds.permanent") },
                { value: "contract", label: t("form.kinds.contract") },
                { value: "fixed_term", label: t("form.kinds.fixed_term") },
              ]}
              {...form.getInputProps("employmentType")}
            />
            <Select
              label={t("form.status")}
              allowDeselect={false}
              data={Object.entries(OFFER_STATUS).map(([value, s]) => ({ value, label: i18n.t(s.label) }))}
              {...form.getInputProps("status")}
            />
          </Group>
          {contract ? (
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <NumberInput
                label={t("form.dayRate")}
                min={0}
                thousandSeparator=","
                data-autofocus
                {...form.getInputProps("dayRate")}
              />
              <Select
                label={t("form.ir35")}
                placeholder={t("form.ir35Placeholder")}
                clearable
                data={[
                  { value: "outside", label: t("form.ir35Options.outside") },
                  { value: "inside", label: t("form.ir35Options.inside") },
                  { value: "unknown", label: t("form.ir35Options.unknown") },
                ]}
                {...form.getInputProps("ir35")}
              />
              <NumberInput
                label={t("form.length")}
                min={0}
                max={120}
                {...form.getInputProps("contractMonths")}
              />
            </SimpleGrid>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <NumberInput
                  label={t("form.salary")}
                  min={0}
                  thousandSeparator=","
                  data-autofocus
                  {...form.getInputProps("salary")}
                />
                <NumberInput
                  label={t("form.bonus")}
                  min={0}
                  thousandSeparator=","
                  {...form.getInputProps("bonus")}
                />
                <NumberInput
                  label={t("form.pension")}
                  min={0}
                  max={100}
                  decimalScale={1}
                  {...form.getInputProps("pensionPercent")}
                />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <TextInput
                  label={t("form.equity")}
                  placeholder={t("form.equityPlaceholder")}
                  {...form.getInputProps("equity")}
                />
                <NumberInput
                  label={t("form.equityWorth")}
                  description={t("form.equityWorthHint")}
                  min={0}
                  thousandSeparator=","
                  {...form.getInputProps("equityValue")}
                />
                <NumberInput
                  label={t("form.holiday")}
                  min={0}
                  max={366}
                  {...form.getInputProps("holidayDays")}
                />
              </SimpleGrid>
              {form.values.employmentType === "fixed_term" && (
                <NumberInput
                  label={t("form.length")}
                  min={0}
                  max={120}
                  {...form.getInputProps("contractMonths")}
                />
              )}
            </>
          )}
          <SimpleGrid cols={{ base: 1, sm: 4 }}>
            <TextInput label={t("form.currency")} maxLength={3} {...form.getInputProps("currency")} />
            <DateInput label={t("form.received")} clearable {...form.getInputProps("receivedOn")} />
            <DateInput label={t("form.replyBy")} clearable {...form.getInputProps("respondBy")} />
            <DateInput label={t("form.start")} clearable {...form.getInputProps("startOn")} />
          </SimpleGrid>
          <Textarea
            label={t("form.benefits")}
            autosize
            minRows={2}
            placeholder={t("form.benefitsPlaceholder")}
            {...form.getInputProps("benefits")}
          />
          <Textarea label={t("form.notes")} autosize minRows={2} {...form.getInputProps("notes")} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {offer ? t("form.save") : t("form.add")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function ir35Fact(value: string) {
  if (value === "outside") return i18n.t("offers:facts.ir35.outside");
  if (value === "inside") return i18n.t("offers:facts.ir35.inside");
  if (value === "unknown") return i18n.t("offers:facts.ir35.unknown");
  return i18n.t("offers:facts.ir35.other", { value });
}

/** One line per figure that's set: "Bonus £8,000", "Pension 6%"… */
export function offerFacts(o: Offer): string[] {
  const facts: string[] = [];
  if (o.value_basis === "day rate") {
    if (o.ir35) facts.push(ir35Fact(o.ir35));
  } else {
    if (o.bonus) facts.push(i18n.t("offers:facts.bonus", { amount: money(o.bonus, o.currency) }));
    if (o.pension_percent != null) facts.push(i18n.t("offers:facts.pension", { percent: o.pension_percent }));
    if (o.equity) facts.push(i18n.t("offers:facts.equity", { equity: o.equity }));
    if (o.holiday_days != null) facts.push(i18n.t("offers:facts.holiday", { count: o.holiday_days }));
  }
  if (o.contract_months) facts.push(i18n.t("offers:facts.months", { count: o.contract_months }));
  if (o.start_on) facts.push(i18n.t("offers:facts.starts", { date: formatDate(o.start_on) }));
  return facts;
}

/** Offers on an application, newest first; a revised offer goes on top. */
export function OffersCard({ applicationId, roleId }: { applicationId: string; roleId: string }) {
  const { t } = useTranslation("offers");
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
          <Title order={4}>{t("card.title")}</Title>
        </Group>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => setEditing("new")}
        >
          {offers?.length ? t("card.addRevised") : t("card.add")}
        </Button>
      </Group>
      {!offers?.length ? (
        <Text size="sm" c="dimmed">
          {t("card.empty")}
        </Text>
      ) : (
        <Stack gap="sm">
          {offers.map((o, i) => (
            <Card key={o.id} withBorder padding="sm" opacity={i === 0 ? 1 : 0.6}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600}>{headline(o)}</Text>
                    <Badge size="sm" variant="light" color={OFFER_STATUS[o.status].color}>
                      {i18n.t(OFFER_STATUS[o.status].label)}
                    </Badge>
                    {i > 0 && (
                      <Badge size="sm" variant="outline" color="gray">
                        {t("card.earlier")}
                      </Badge>
                    )}
                  </Group>
                  {o.annual_value != null && o.value_basis === "salary" && (
                    <Text size="sm">
                      {t("card.worthSalary", { amount: money(o.annual_value, o.currency) })}
                    </Text>
                  )}
                  {o.annual_value != null && o.value_basis === "day rate" && (
                    <Text size="sm">
                      {t("card.worthDayRate", { amount: money(o.annual_value, o.currency) })}
                    </Text>
                  )}
                  {offerFacts(o).length > 0 && (
                    <Text size="xs" c="dimmed">
                      {offerFacts(o).join(" · ")}
                    </Text>
                  )}
                  {o.respond_by && o.status === "pending" && (
                    <Text size="xs" c="orange">
                      {t("card.replyBy", { date: formatDate(o.respond_by) })}
                    </Text>
                  )}
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon variant="subtle" aria-label={t("card.edit")} onClick={() => setEditing(o)}>
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={t("card.delete")}
                    onClick={() => {
                      if (window.confirm(t("card.deleteConfirm"))) remove.mutate(o.id);
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
