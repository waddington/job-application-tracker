import {
  Anchor,
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Switch,
  Table,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { IconCash, IconTrophy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { headline, money, OFFER_STATUS, useOffers, type Offer } from "../api/offerHooks";
import { i18n } from "../i18n";
import { formatDate } from "../utils/time";

const dash = (
  <Text span c="dimmed">
    —
  </Text>
);

/** "Outside", or a value the app doesn't know as saved (capitalised, as ever). */
function ir35Cell(value: string, t: TFunction<"offers">) {
  if (value === "outside") return t("page.ir35.outside");
  if (value === "inside") return t("page.ir35.inside");
  if (value === "unknown") return t("page.ir35.unknown");
  return (
    <Text span tt="capitalize">
      {value}
    </Text>
  );
}

function rows(t: TFunction<"offers">): { label: string; cell: (o: Offer) => ReactNode }[] {
  return [
    {
      label: t("page.rows.status"),
      cell: (o) => (
        <Badge size="sm" variant="light" color={OFFER_STATUS[o.status].color}>
          {i18n.t(OFFER_STATUS[o.status].label)}
        </Badge>
      ),
    },
    { label: t("page.rows.pay"), cell: (o) => headline(o) },
    { label: t("page.rows.bonus"), cell: (o) => (o.bonus ? money(o.bonus, o.currency) : dash) },
    {
      label: t("page.rows.pension"),
      cell: (o) => (o.pension_percent != null ? t("page.percent", { percent: o.pension_percent }) : dash),
    },
    {
      label: t("page.rows.equity"),
      cell: (o) =>
        o.equity || o.equity_value ? (
          <>
            {o.equity}
            {o.equity_value ? (
              <Text size="xs" c="dimmed">
                {t("page.equityWorth", { amount: money(o.equity_value, o.currency) })}
              </Text>
            ) : null}
          </>
        ) : (
          dash
        ),
    },
    {
      label: t("page.rows.holiday"),
      cell: (o) => (o.holiday_days != null ? t("page.days", { count: o.holiday_days }) : dash),
    },
    { label: t("page.rows.ir35"), cell: (o) => (o.ir35 ? ir35Cell(o.ir35, t) : dash) },
    {
      label: t("page.rows.length"),
      cell: (o) => (o.contract_months ? t("page.months", { count: o.contract_months }) : dash),
    },
    { label: t("page.rows.benefits"), cell: (o) => o.benefits ?? dash },
    { label: t("page.rows.start"), cell: (o) => (o.start_on ? formatDate(o.start_on) : dash) },
    { label: t("page.rows.replyBy"), cell: (o) => (o.respond_by ? formatDate(o.respond_by) : dash) },
    { label: t("page.rows.notes"), cell: (o) => o.notes ?? dash },
  ];
}

/** Offers side by side (P6): each application's newest offer, worth-a-year first. */
export function OffersPage() {
  const { t } = useTranslation("offers");
  const [showClosed, setShowClosed] = useState(false);
  const { data, isLoading } = useOffers({});
  const offers = (data ?? [])
    .filter((o) => showClosed || o.status === "pending" || o.status === "accepted")
    .sort((a, b) => (b.annual_value ?? -1) - (a.annual_value ?? -1));
  // The best is only comparable within one currency: the most common one among these offers.
  const counts = new Map<string, number>();
  for (const o of offers) counts.set(o.currency ?? "", (counts.get(o.currency ?? "") ?? 0) + 1);
  const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const best = offers.find((o) => (o.currency ?? "") === main && o.annual_value != null);

  return (
    <Stack maw={1200}>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <IconCash size={26} stroke={1.6} />
          <Title order={2}>{t("page.title")}</Title>
        </Group>
        <Switch
          label={t("page.showClosed")}
          checked={showClosed}
          onChange={(e) => setShowClosed(e.currentTarget.checked)}
        />
      </Group>
      {isLoading ? (
        <Loader />
      ) : !offers.length ? (
        <Card withBorder>
          <Text c="dimmed" size="sm">
            {data?.length ? t("page.noneOpen") : t("page.none")}
          </Text>
        </Card>
      ) : (
        <Card withBorder>
          <Text size="sm" c="dimmed" mb="sm">
            {t("page.explain")}
          </Text>
          <Table.ScrollContainer minWidth={240 + 220 * offers.length}>
            <Table withColumnBorders verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={160}>
                    <VisuallyHidden>{t("page.detail")}</VisuallyHidden>
                  </Table.Th>
                  {offers.map((o) => (
                    <Table.Th key={o.id}>
                      <Anchor component={Link} to={`/applications/${o.application_id}`} fw={700}>
                        {o.company_name}
                      </Anchor>
                      <Text size="xs" c="dimmed" fw={400}>
                        {o.role_title}
                      </Text>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Th scope="row">{t("page.worth")}</Table.Th>
                  {offers.map((o) => (
                    <Table.Td key={o.id}>
                      <Group gap={6} wrap="nowrap">
                        <Text fw={700}>{money(o.annual_value, o.currency)}</Text>
                        {best?.id === o.id && offers.length > 1 && (
                          <Badge size="sm" color="green" leftSection={<IconTrophy size={12} />}>
                            {t("page.highest")}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                  ))}
                </Table.Tr>
                {rows(t).map((row) => (
                  <Table.Tr key={row.label}>
                    <Table.Th scope="row">{row.label}</Table.Th>
                    {offers.map((o) => (
                      <Table.Td key={o.id}>
                        <Text size="sm" component="div">
                          {row.cell(o)}
                        </Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}
