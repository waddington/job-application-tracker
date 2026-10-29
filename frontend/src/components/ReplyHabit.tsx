import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { overdueBy, replyHabit, type ReplyHabit as Habit } from "../utils/replies";
import { useToday } from "../utils/useToday";

/** "Usually replies within 2 working days", and "longer than usual" when you're waiting past it. */
export function ReplyHabit({ contact, size = "xs" }: { contact: Habit; size?: "xs" | "sm" }) {
  const { t } = useTranslation("people");
  const today = useToday();
  const habit = replyHabit(contact);
  if (!habit) return null;
  const late = overdueBy(contact, today);
  return (
    <Text size={size} c="dimmed">
      {habit}
      {late > 0 && (
        <Text span size={size} c="orange" fw={600}>
          {" "}
          · {t("replies.longerThanUsual", { count: late })}
        </Text>
      )}
    </Text>
  );
}
