import { createTheme } from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import classes from "./theme.module.css";

// Every date picker marks today (classNames here merge with any a picker passes itself), and
// shows its date day-month-year, like the rest of the app ("31 Oct 2026"), not Mantine's
// American "October 31, 2026".
const today = { defaultProps: { highlightToday: true }, classNames: { day: classes.day } };
const dayFirst = { ...today, defaultProps: { ...today.defaultProps, valueFormat: "D MMM YYYY" } };
const dayFirstTime = { ...today, defaultProps: { ...today.defaultProps, valueFormat: "D MMM YYYY HH:mm" } };

export const theme = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontWeight: "650" },
  components: {
    DateInput: DateInput.extend(dayFirst),
    DateTimePicker: DateTimePicker.extend(dayFirstTime),
  },
});
