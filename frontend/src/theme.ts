import {
  Alert,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  Card,
  Checkbox,
  createTheme,
  defaultVariantColorsResolver,
  Drawer,
  FileInput,
  Input,
  Menu,
  Modal,
  MultiSelect,
  Notification,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  Switch,
  Table,
  TagsInput,
  TextInput,
  Timeline,
  Title,
  virtualColor,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type VariantColorsResolver,
} from "@mantine/core";
import { DateInput, DateTimePicker, TimeInput, TimePicker } from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { FALLBACK } from "./i18n/language";
import classes from "./theme.module.css";
import { foldedOptionsFilter } from "./utils/fold";
import { datePattern, dayjsLocale } from "./utils/format";

dayjs.extend(customParseFormat);

// Every date picker marks today (classNames here merge with any a picker passes itself), and
// writes its date the way the rest of the app does in your language ("31 Oct 2026" in English),
// not Mantine's American "October 31, 2026".
const today = { defaultProps: { highlightToday: true }, classNames: { day: classes.day } };

/**
 * Reads a date typed into a date box: first exactly as the box writes it ("2026年3月5日", "5 Mar
 * 2026"), then as before this existed, whatever dayjs and the browser make of it ("2026-03-05",
 * "March 5, 2026"). So English reads typed dates as it always did, and Chinese can be typed too.
 */
export const typedDate =
  (pattern: string, lang: string) =>
  (text: string): string | null => {
    const exact = dayjs(text, pattern, dayjsLocale(lang), true);
    const day = exact.isValid() ? exact : dayjs(text);
    return day.isValid() ? day.format("YYYY-MM-DD") : null;
  };

// The look (docs/rfc/app-redesign.md §2): the website's plum and pastels, Inter and JetBrains Mono
// (bundled in main.tsx, never fetched), big radii and soft shadows. The values behind the colours
// are in tokens.css.

// Plum, the primary colour: in light mode the website's ink (#2a1e3f, at shade 6, Mantine's light
// primary shade); in dark mode its lavender (#c9b8f0, at shade 8, the dark primary shade), with
// dark text on it (autoContrast).
const plumInk: MantineColorsTuple = [
  "#f4f1fb",
  "#e9e4f8",
  "#d6cdf1",
  "#c9b8f0",
  "#a994dc",
  "#6a5591",
  "#2a1e3f",
  "#3a2c54",
  "#1b1328",
  "#140e1e",
];
const plumGlow: MantineColorsTuple = [
  "#140e1e",
  "#1b1328",
  "#221832",
  "#2a1e3f",
  "#4a3a68",
  "#6a5591",
  "#8c74d8",
  "#a994dc",
  "#c9b8f0",
  "#d9cdf6",
];

// Mantine's dark greys, tinted plum: text at 0, dimmed at 2, borders at 4, cards at 6, the page at 7.
const plumDark: MantineColorsTuple = [
  "#ece8f6",
  "#cbc3dc",
  "#a89fbc",
  "#7f7594",
  "#4a405f",
  "#3a3150",
  "#2d2541",
  "#1d1729",
  "#130e1d",
  "#0d0914",
];

// The Chinese fonts come last: Latin letters are always found in the fonts before them, so English
// looks the same, and Chinese gets each system's Simplified Chinese font (macOS, Windows, Linux)
// rather than whatever the browser falls back to. A future Japanese or Korean translation would
// need its own fonts ahead of these, for its own glyph shapes. Mono labels in Chinese fall back to
// the same Chinese sans.
const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC"';
const SANS = `"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, ${CJK}, sans-serif`;
const MONO = `"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, ${CJK}, monospace`;

/** The colours stages and statuses use (Mantine's names), each with a pastel and an ink in tokens.css. */
export const PASTELS = [
  "gray",
  "dark",
  "blue",
  "cyan",
  "indigo",
  "violet",
  "grape",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
  "red",
  "pink",
] as const;

/**
 * Points Mantine's colour variables at the tokens: plum ink on white, and the pastels with their
 * inks for light badges and buttons (light) or as light text on a faint wash (dark).
 */
export const cssVariablesResolver: CSSVariablesResolver = () => {
  const light: Record<string, string> = {
    "--mantine-color-text": "var(--jat-ink)",
    "--mantine-color-dimmed": "var(--jat-ink-soft)",
    "--mantine-color-default-border": "var(--jat-ink-faint)",
    "--mantine-color-anchor": "var(--jat-anchor)",
    "--mantine-color-placeholder": "var(--jat-placeholder)",
    // Greys with a little lilac, for soft fills (Today's rows, hovers).
    "--mantine-color-gray-0": "#f9f8fd",
    "--mantine-color-gray-1": "#f3f0fa",
    "--mantine-color-gray-2": "#e9e5f3",
    "--mantine-color-gray-3": "#dcd6ea",
    // Coloured text ("Replied today", "Waiting 8 days"): darker than shade 6, for 4.5:1 on the tints.
    "--mantine-color-orange-text": "#a84400",
    "--mantine-color-red-text": "#b42323",
    "--mantine-color-yellow-text": "#7d5800",
    "--mantine-color-green-text": "#22692f",
    "--mantine-color-teal-text": "#0b6b4f",
    "--mantine-color-blue-text": "#1a5aa3",
    "--mantine-color-default-color": "var(--jat-ink)",
    // A grey filled button (Pass), under white at 4.5:1.
    "--mantine-color-gray-filled": "#70777f",
  };
  const dark: Record<string, string> = {
    "--mantine-color-anchor": "var(--jat-anchor)",
    "--mantine-color-placeholder": "var(--jat-placeholder)",
  };
  for (const scheme of [light, dark]) {
    // A field's error and its required star: the red that reads as text.
    scheme["--mantine-color-error"] = "var(--mantine-color-red-text)";
    scheme["--mantine-color-plum-light"] = "var(--jat-p-plum)";
    scheme["--mantine-color-plum-light-hover"] = "var(--jat-p-plum-hover)";
    scheme["--mantine-color-plum-light-color"] = "var(--jat-i-plum)";
  }
  for (const c of PASTELS) {
    const v = `--mantine-color-${c}`;
    light[`${v}-light`] = `var(--jat-p-${c})`;
    light[`${v}-light-hover`] = `color-mix(in srgb, var(--jat-p-${c}) 88%, var(--jat-i-${c}))`;
    light[`${v}-light-color`] = `var(--jat-i-${c})`;
    light[`${v}-outline`] = `var(--jat-i-${c})`;
    // Gray and dark are greys already: a fainter wash of their pastel, and dark's text a step dimmer.
    const grey = c === "gray" || c === "dark";
    const wash = grey ? `var(--jat-p-${c})` : `var(${v}-5)`;
    const strength = c === "gray" ? 12 : c === "dark" ? 10 : 24;
    dark[`${v}-light`] = `color-mix(in srgb, ${wash} ${strength}%, transparent)`;
    dark[`${v}-light-hover`] = `color-mix(in srgb, ${wash} ${strength + 10}%, transparent)`;
    dark[`${v}-light-color`] = c === "dark" ? "#b9b1cc" : `var(--jat-p-${c})`;
    dark[`${v}-outline`] = c === "dark" ? "#a89fbc" : `var(--jat-p-${c})`;
  }
  return { variables: {}, light, dark };
};

/** The option picked with the arrow keys in a dropdown sits on the primary colour. */
const onPrimary = { classNames: { option: classes.option } };

/**
 * A one-line box's hint goes under the box, not between its label and the box, so boxes side by side
 * line up whether or not each has a hint (fix-new-application-fields-misaligned). A big text box
 * (Textarea) keeps its hint above, where it's read before writing.
 */
const hintBelow = {
  defaultProps: {
    inputWrapperOrder: ["label", "input", "description", "error"] as (
      "label" | "input" | "description" | "error"
    )[],
  },
};

/**
 * How far below its box a dropdown opens: past the box's hint, if it has one under it, so the list never
 * covers the hint ("New company: it's added for you" shows exactly while you type). Floating UI calls it
 * each time it places the dropdown, so a hint that changes as you type is measured afresh. Above the box
 * (when there's no room below) the usual 8 px.
 */
export const clearHint = ({
  elements,
  placement,
}: {
  elements: { reference: unknown };
  placement: string;
}) => {
  const box = elements.reference;
  if (!(box instanceof Element) || !placement.startsWith("bottom")) return 8;
  // A box of pills (MultiSelect, TagsInput) anchors its list to a wrapper around the input with the id.
  const id = box.id || box.querySelector("input[id]")?.id;
  if (!id) return 8;
  const hint = document.getElementById(`${id}-description`);
  if (!hint) return 8;
  return Math.max(8, Math.ceil(hint.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom) + 8);
};
// Mantine types a dropdown's offset as a number, but hands it to Floating UI as it is, which takes a function.
const belowHint = clearHint as unknown as number;

const oneLine = {
  // What you type finds options without caring about accents or case, as every search does.
  defaultProps: {
    ...hintBelow.defaultProps,
    comboboxProps: { offset: belowHint },
    filter: foldedOptionsFilter,
  },
  ...onPrimary,
};
const pickerBelowHint = { ...hintBelow.defaultProps, popoverProps: { offset: belowHint } };

/**
 * Red subtle and outline actions (Delete) in the red that reads at 4.5:1 on white, the page and the dark
 * card, not the pastel's maroon ink (which suits a red badge on its pastel), with a hover that keeps it.
 */
export const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input);
  if (input.color !== "red" || !["subtle", "outline", "transparent"].includes(input.variant)) return colors;
  return {
    ...colors,
    color: "var(--mantine-color-red-text)",
    hover: input.variant === "transparent" ? colors.hover : "var(--jat-danger-hover)",
    border: input.variant === "outline" ? "1px solid var(--mantine-color-red-text)" : colors.border,
  };
};

/** Dialogs: a lifted card with a card's title, under a see-through plum (theme.module.css). */
const dialog = {
  defaultProps: {
    padding: "var(--jat-dialog-padding)",
    shadow: "xl",
    overlayProps: { color: "var(--jat-overlay)", backgroundOpacity: 1, blur: 2 },
  },
  classNames: { root: classes.dialog, content: classes.dialogContent, title: classes.dialogTitle },
};

/**
 * A colour's deeper pastel, as bars use it (tokens.css), for the key beside a bar; a colour without one
 * keeps Mantine's filled shade.
 */
export const barColor = (color: string) => `var(--jat-bar-${color}, var(--mantine-color-${color}-filled))`;

/**
 * A stage colour as a chart mark (tokens.css), at 3:1 or more on a card in either mode; a Mantine colour without one
 * keeps Mantine's middle shade, and anything that's neither (a typo in the workflow, "#800080") the chart grey.
 */
export const chartColor = (color: string) =>
  /^[a-z]+$/i.test(color)
    ? `var(--jat-chart-${color}, var(--mantine-color-${color}-6, var(--jat-chart-gray)))`
    : "var(--jat-chart-gray)";

/** Whether a button is the plum (primary) filled one, which carries the website's gradient. */
const isPlumFilled = (primary: string, props: { variant?: string; color?: string }) =>
  (props.variant ?? "filled") === "filled" && (props.color === undefined || props.color === primary);

/** The app's theme for a language (only the date pickers' pattern differs between languages). */
export function themeFor(lang: string) {
  const pickerDate = datePattern("pickerDate", lang);
  return createTheme({
    colors: {
      plumInk,
      plumGlow,
      plum: virtualColor({ name: "plum", light: "plumInk", dark: "plumGlow" }),
      dark: plumDark,
    },
    primaryColor: "plum",
    autoContrast: true,
    variantColorResolver,
    fontFamily: SANS,
    fontFamilyMonospace: MONO,
    // Light display titles: 300 for the biggest, 400 below.
    headings: {
      fontFamily: SANS,
      fontWeight: "400",
      sizes: { h1: { fontWeight: "300" }, h2: { fontWeight: "300" } },
    },
    // Big radii: cards about 34 px (xl), inputs and menus 18 px (md), small parts 8-12 px.
    defaultRadius: "md",
    radius: { xs: "8px", sm: "12px", md: "18px", lg: "26px", xl: "34px" },
    // Soft, wide shadows in the plum ink (black in dark mode).
    shadows: {
      xs: "0 4px 14px -8px rgb(var(--jat-shadow) / 0.22)",
      sm: "0 18px 50px -24px rgb(var(--jat-shadow) / 0.28)",
      md: "0 22px 56px -24px rgb(var(--jat-shadow) / 0.34)",
      lg: "0 28px 70px -26px rgb(var(--jat-shadow) / 0.4)",
      xl: "0 36px 90px -30px rgb(var(--jat-shadow) / 0.45)",
    },
    components: {
      // Cards: roomy at the top level and compact inside another card or a well; their padding and
      // radius come from theme.module.css (a padding or radius passed to a card still wins). A card
      // that holds cards (variant "well") is a soft well of the page's tint.
      Card: Card.extend({
        defaultProps: { radius: "var(--jat-card-radius)", padding: "var(--jat-card-padding)", shadow: "sm" },
        classNames: (_theme, props) => ({
          root: props.variant === "well" ? `${classes.card} ${classes.well}` : classes.card,
        }),
      }),
      Paper: Paper.extend({
        classNames: (_theme, props) => (props.variant === "well" ? { root: classes.well } : {}),
      }),
      // Pill buttons, filled ones lifted by a soft shadow.
      Button: Button.extend({
        defaultProps: { radius: "xl" },
        classNames: (theme, props) => ({
          root: isPlumFilled(theme.primaryColor, props)
            ? `${classes.button} ${classes.plum}`
            : classes.button,
        }),
      }),
      Badge: Badge.extend({ defaultProps: { radius: "xl" } }),
      Alert: Alert.extend({ classNames: { root: classes.alert } }),
      Anchor: Anchor.extend({ classNames: { root: classes.link } }),
      Notification: Notification.extend({ classNames: { description: classes.toastText } }),
      ScrollArea: ScrollArea.extend({ classNames: { viewport: classes.viewport } }),
      SegmentedControl: SegmentedControl.extend({ classNames: { indicator: classes.picked } }),
      // A page's title (every page's is an h2): a big, light display title. A card's own title (an h3
      // or h4 without a size of its own) is a step bigger and light too (theme.module.css).
      Title: Title.extend({
        classNames: (_theme, props) =>
          props.order === 2
            ? { root: classes.pageTitle }
            : (props.order === 3 || props.order === 4) && props.size === undefined
              ? { root: classes.cardTitle }
              : {},
        vars: (_theme, props) => ({
          root:
            props.order === 2
              ? { "--title-fz": "clamp(32px, 2.2vw + 22px, 52px)", "--title-lh": "1.04" }
              : {},
        }),
      }),
      // Table headers are the website's eyebrow: mono capitals after a small square; rows hover in plum.
      Table: Table.extend({ classNames: { table: classes.table, th: classes.th } }),
      Modal: Modal.extend({
        ...dialog,
        defaultProps: { ...dialog.defaultProps, radius: "var(--jat-dialog-radius)" },
      }),
      // A Drawer (the phone's More sheet) looks like the dialogs; the application panel is DockedPanel, drawn its own way.
      Drawer: Drawer.extend(dialog),
      // Every box you type in: an outline you can see (theme.module.css).
      Input: Input.extend({ classNames: { wrapper: classes.input } }),
      TextInput: TextInput.extend(hintBelow),
      NumberInput: NumberInput.extend(hintBelow),
      FileInput: FileInput.extend(hintBelow),
      Menu: Menu.extend({ classNames: { item: classes.menuItem } }),
      // Bars (the pipeline on Today) in deeper pastels, with ink numbers.
      Progress: Progress.extend({
        classNames: {
          root: classes.progress,
          section: classes.progressSection,
          label: classes.progressLabel,
        },
      }),
      // Mantine writes white on the primary colour in a few places; on dark mode's lavender that's
      // unreadable, so these take the primary's contrast colour (white on plum, dark on lavender).
      Checkbox: Checkbox.extend({
        classNames: { input: classes.tick },
        vars: (_theme, props) => ({
          root: {
            "--checkbox-icon-color":
              props.color || props.iconColor || props.variant === "outline"
                ? undefined
                : "var(--mantine-primary-color-contrast)",
          },
        }),
      }),
      Timeline: Timeline.extend({
        vars: (_theme, props) => ({
          root: {
            "--tl-icon-color": props.color ? undefined : "var(--mantine-primary-color-contrast)",
          },
        }),
      }),
      // A switch's track and thumb are ringed while off; a primary one, on, has its label and thumb in the
      // primary's contrast colour.
      Switch: Switch.extend({
        classNames: (_theme, props) =>
          props.color
            ? { track: classes.switchTrack, thumb: classes.switchThumb }
            : { input: classes.switchInput, track: classes.switchTrack, thumb: classes.switchThumb },
      }),
      Select: Select.extend(oneLine),
      MultiSelect: MultiSelect.extend(oneLine),
      Autocomplete: Autocomplete.extend(oneLine),
      TagsInput: TagsInput.extend(oneLine),
      // The time fields (in DateTimePicker too): the focused field and the chosen hour or minute.
      TimePicker: TimePicker.extend({
        defaultProps: pickerBelowHint,
        classNames: { field: classes.timeField, control: classes.timeControl },
      }),
      TimeInput: TimeInput.extend({ ...hintBelow, classNames: { input: classes.timeInput } }),
      DateInput: DateInput.extend({
        ...today,
        defaultProps: {
          ...today.defaultProps,
          ...pickerBelowHint,
          valueFormat: pickerDate,
          dateParser: typedDate(pickerDate, lang),
        },
      }),
      DateTimePicker: DateTimePicker.extend({
        ...today,
        defaultProps: {
          ...today.defaultProps,
          ...pickerBelowHint,
          valueFormat: datePattern("pickerDateTime", lang),
        },
      }),
    },
  });
}

/** The English theme. */
export const theme = themeFor(FALLBACK);
