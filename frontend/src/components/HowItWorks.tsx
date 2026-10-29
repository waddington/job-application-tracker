import { List, Stack, Text, ThemeIcon } from "@mantine/core";
import { Trans, useTranslation } from "react-i18next";

// Bold marks a button or page name; italics an option.
const MARKUP = { b: <b />, i: <i /> };

const STEPS = [
  { title: "howItWorks.addTitle", body: "howItWorks.add" },
  { title: "howItWorks.moveTitle", body: "howItWorks.move" },
  { title: "howItWorks.logTitle", body: "howItWorks.log" },
  { title: "howItWorks.startTitle", body: "howItWorks.startFromToday" },
  { title: "howItWorks.lookBackTitle", body: "howItWorks.lookBack" },
] as const;

/** The everyday loop as numbered steps (used by the help button and the Today page). */
export function HowItWorks() {
  const { t } = useTranslation("today");
  return (
    <Stack gap="sm">
      <List
        type="ordered"
        spacing="sm"
        center={false}
        icon={null}
        styles={{ itemWrapper: { alignItems: "flex-start" } }}
      >
        {STEPS.map((step, n) => (
          <List.Item
            key={step.title}
            icon={
              <ThemeIcon size={24} radius="xl" variant="light" aria-hidden>
                {n + 1}
              </ThemeIcon>
            }
          >
            <Text fw={600} size="sm">
              {t(step.title)}
            </Text>
            <Text size="sm" c="dimmed">
              <Trans t={t} i18nKey={step.body} components={MARKUP} />
            </Text>
          </List.Item>
        ))}
      </List>
      <Text size="xs" c="dimmed">
        <Trans t={t} i18nKey="howItWorks.noRole" components={MARKUP} />
      </Text>
    </Stack>
  );
}
