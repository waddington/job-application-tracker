import { Text } from "@mantine/core";

import { shadow } from "../i18n/shadow";
import { overdueBy, replyHabit, type ReplyHabit as Habit } from "../utils/replies";
import { useToday } from "../utils/useToday";

/** "Usually replies within 2 working days", and "longer than usual" when you're waiting past it. */
export function ReplyHabit({ contact, size = "xs" }: { contact: Habit; size?: "xs" | "sm" }) {
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
          ·{" "}
          {shadow(
            "people:replies.longerThanUsual",
            `waiting ${late} working day${late === 1 ? "" : "s"} longer than usual`,
            { count: late },
          )}
        </Text>
      )}
    </Text>
  );
}
