import {
  Button,
  Card,
  Checkbox,
  DEFAULT_THEME,
  defaultCssVariablesResolver,
  defaultVariantColorsResolver,
  MantineProvider,
  Menu,
  mergeMantineTheme,
  Modal,
  Paper,
  Select,
  Table,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput, DatesProvider, DateTimePicker } from "@mantine/dates";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import dayjs from "dayjs";
import { DRIFT_TINTS } from "./drift";
import {
  clearHint,
  cssVariablesResolver,
  PASTELS,
  theme,
  themeFor,
  typedDate,
  variantColorResolver,
} from "./theme";
import classes from "./theme.module.css";
import { dayjsLocale } from "./utils/format";

test.each([
  ["en", "5 Mar 2026", "5 Mar 2026 09:07"],
  ["zh-CN", "2026年3月5日", "2026年3月5日 09:07"],
])("date pickers write the date the %s way", (lang, day, dayTime) => {
  render(
    <MantineProvider theme={themeFor(lang)}>
      <DatesProvider settings={{ locale: dayjsLocale(lang) }}>
        <DateInput label="Day" defaultValue="2026-03-05" />
        <DateTimePicker label="At" defaultValue="2026-03-05 09:07:00" />
      </DatesProvider>
    </MantineProvider>,
  );
  expect(screen.getByLabelText("Day")).toHaveValue(day);
  expect(screen.getByLabelText("At")).toHaveTextContent(dayTime);
});

test("a date typed in Chinese is read", () => {
  expect(typedDate("YYYY[年]M[月]D[日]", "zh-CN")("2026年3月5日")).toBe("2026-03-05");
  expect(typedDate("YYYY[年]M[月]D[日]", "zh-CN")("2026-03-05")).toBe("2026-03-05");
  expect(typedDate("YYYY[年]M[月]D[日]", "zh-CN")("不是日期")).toBeNull();
});

test("a date typed in English is read exactly as before (dayjs and the browser alone)", () => {
  const before = (text: string) => (dayjs(text).isValid() ? dayjs(text).format("YYYY-MM-DD") : null);
  for (const text of [
    "5 Mar 2026",
    "05 Mar 2026",
    "2026-03-05",
    "March 5, 2026",
    "3/5/2026",
    "5 Mar",
    "nonsense",
    "",
  ]) {
    expect(typedDate("D MMM YYYY", "en")(text), text).toBe(before(text));
  }
});

test("typing a Chinese date into a date box keeps it", () => {
  let picked: string | null = null;
  render(
    <MantineProvider theme={themeFor("zh-CN")}>
      <DatesProvider settings={{ locale: dayjsLocale("zh-CN") }}>
        <DateInput label="Day" onChange={(v) => (picked = v)} />
      </DatesProvider>
    </MantineProvider>,
  );
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026年3月5日" } });
  expect(picked).toBe("2026-03-05");
});

test.each<[string, ReactNode]>([
  ["DateInput", <DateInput label="When" />],
  ["DateTimePicker", <DateTimePicker label="When" />],
  ["a picker with its own classNames", <DateInput label="When" classNames={{ input: "mine" }} />],
])("%s marks today", async (_name, picker) => {
  render(<MantineProvider theme={theme}>{picker}</MantineProvider>);
  fireEvent.click(screen.getByLabelText("When"));
  await waitFor(() => expect(document.querySelector("[data-today]")).not.toBeNull());
  const today = document.querySelector("[data-today]");
  expect(today).toHaveAttribute("data-highlight-today");
  expect(today).toHaveClass(String(classes.day));
});

const full = mergeMantineTheme(DEFAULT_THEME, theme);

test("plum is the primary colour, lavender in dark mode, over plum-tinted dark greys", () => {
  expect(full.primaryColor).toBe("plum");
  expect(full.colors.plumInk?.[6]).toBe("#2a1e3f"); // light primary shade
  expect(full.colors.plumGlow?.[8]).toBe("#c9b8f0"); // dark primary shade
  expect(full.colors.dark?.[7]).toBe("#1d1729"); // the page
  expect(full.colors.dark?.[6]).toBe("#2d2541"); // cards
  // Dark text on the lavender, white on the plum.
  expect(defaultCssVariablesResolver(full).dark["--mantine-color-plum-contrast"]).toBe(
    "var(--mantine-color-black)",
  );
  expect(defaultCssVariablesResolver(full).light["--mantine-color-plum-contrast"]).toBe(
    "var(--mantine-color-white)",
  );
});

test("Inter and JetBrains Mono come first, with the Chinese fonts kept as fallbacks", () => {
  for (const stack of [full.fontFamily, full.headings.fontFamily, full.fontFamilyMonospace]) {
    expect(stack).toContain('"Noto Sans CJK SC"');
    expect(stack).toContain('"PingFang SC"');
  }
  expect(full.fontFamily).toMatch(/^"Inter Variable"/);
  expect(full.fontFamilyMonospace).toMatch(/^"JetBrains Mono Variable"/);
});

const tokens = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");
const lightTokens = tokens.split(":root[data-mantine-color-scheme")[0]!;
const token = (name: string) => {
  const hex = new RegExp(`--jat-${name}: (#[0-9a-f]{6});`).exec(lightTokens)?.[1];
  if (!hex) throw new Error(`no --jat-${name}`);
  return hex;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test.each(PASTELS)("%s: its ink reads on its pastel, and ink numbers on its bar (4.5:1)", (colour) => {
  expect(contrast(token(`i-${colour}`), token(`p-${colour}`))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(token("bar-ink"), token(`bar-${colour}`))).toBeGreaterThanOrEqual(4.5);
});

test("coloured text reads at 4.5:1 on white and on its own pastel", () => {
  const { light } = cssVariablesResolver(full);
  for (const colour of ["orange", "red", "yellow", "green", "teal", "blue"]) {
    const text = light[`--mantine-color-${colour}-text`]!;
    expect(contrast(text, "#ffffff"), colour).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, token(`p-${colour}`)), colour).toBeGreaterThanOrEqual(4.5);
  }
});

// The text on the page's drift tints is checked across the whole cycle (docs/rfc/app-redesign.md §8).
const tints = (scheme: "light" | "dark") => DRIFT_TINTS[scheme];
/** A colour at some opacity over a background, as a hex. */
const over = (hex: string, alpha: number, bg: string) =>
  "#" +
  [1, 3, 5]
    .map((i) => {
      const [a, b] = [parseInt(hex.slice(i, i + 2), 16), parseInt(bg.slice(i, i + 2), 16)];
      return Math.round(a * alpha + b * (1 - alpha))
        .toString(16)
        .padStart(2, "0");
    })
    .join("");

test("text, dimmed text and coloured text read at 4.5:1 on every tint of the drift", () => {
  const { light } = cssVariablesResolver(full);
  for (const tint of tints("light")) {
    expect(contrast(token("ink"), tint), tint).toBeGreaterThanOrEqual(4.5);
    expect(contrast(over(token("ink"), 0.7, tint), tint), tint).toBeGreaterThanOrEqual(4.5);
    for (const colour of ["orange", "red", "yellow", "green", "teal", "blue"]) {
      expect(
        contrast(light[`--mantine-color-${colour}-text`]!, tint),
        `${colour} on ${tint}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const tint of tints("dark")) {
    expect(contrast("#ece8f6", tint), tint).toBeGreaterThanOrEqual(4.5);
    // Dark mode's dimmed text is Mantine's dark-2 (theme.ts, plumDark).
    expect(contrast(full.colors.dark[2], tint), tint).toBeGreaterThanOrEqual(4.5);
  }
});

test("Today's tiles in dark mode keep dimmed and red text at 4.5:1, resting and on hover", () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "pages", "TodayPage.module.css"),
    "utf8",
  );
  const dark = /\[data-mantine-color-scheme="dark"\]\) \.rows \{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(dark).toContain(
    "--today-tint: color-mix(in srgb, var(--mantine-color-dark-5) 50%, var(--mantine-color-dark-6));",
  );
  expect(dark).toContain("--today-tint-strong: var(--mantine-color-dark-5);");
  const [card, step] = [full.colors.dark[6], full.colors.dark[5]];
  const resting = over(step, 0.5, card);
  // Dimmed text is dark-2; red text in dark mode is Mantine's red-4.
  for (const bg of [resting, step]) {
    expect(contrast(full.colors.dark[2], bg), bg).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DEFAULT_THEME.colors.red[4], bg), bg).toBeGreaterThanOrEqual(4.5);
  }
  // Each step is still visibly different: from the card, and from the resting tile.
  expect(contrast(resting, card)).toBeGreaterThan(1.05);
  expect(contrast(step, resting)).toBeGreaterThan(1.05);
});

test("a page's title (an h2) is the display title; other headings aren't", () => {
  render(
    <MantineProvider theme={theme}>
      <Title order={2}>Today</Title>
      <Title order={3}>Your move</Title>
    </MantineProvider>,
  );
  expect(screen.getByRole("heading", { name: "Today" })).toHaveClass(String(classes.pageTitle));
  expect(screen.getByRole("heading", { name: "Your move" })).not.toHaveClass(String(classes.pageTitle));
});

test("a card's own title (an h3 or h4 with no size of its own) carries the card title class", () => {
  render(
    <MantineProvider theme={theme}>
      <Title order={4}>Interviews</Title>
      <Title order={3} size="h5">
        Sized
      </Title>
    </MantineProvider>,
  );
  expect(screen.getByRole("heading", { name: "Interviews" })).toHaveClass(String(classes.cardTitle));
  expect(screen.getByRole("heading", { name: "Sized" })).not.toHaveClass(String(classes.cardTitle));
});

test("cards take their padding and radius from the theme unless given their own; a well is marked", () => {
  render(
    <MantineProvider theme={theme}>
      <Card data-testid="plain">Plain</Card>
      <Card data-testid="own" padding="sm" radius="md">
        Own
      </Card>
      <Card data-testid="well" variant="well">
        Well
      </Card>
      <Paper data-testid="column" variant="well">
        Column
      </Paper>
    </MantineProvider>,
  );
  const plain = screen.getByTestId("plain");
  expect(plain.style.getPropertyValue("--card-padding")).toBe("var(--jat-card-padding)");
  expect(plain.style.getPropertyValue("--paper-radius")).toBe("var(--jat-card-radius)");
  expect(plain).toHaveClass(String(classes.card));
  expect(plain).not.toHaveClass(String(classes.well));
  const own = screen.getByTestId("own");
  expect(own.style.getPropertyValue("--card-padding")).toBe("var(--mantine-spacing-sm)");
  expect(own.style.getPropertyValue("--paper-radius")).toBe("var(--mantine-radius-md)");
  expect(screen.getByTestId("well")).toHaveClass(String(classes.card), String(classes.well));
  expect(screen.getByTestId("column")).toHaveClass(String(classes.well));
});

test("Mantine's light and outline colours are the pastels and their inks", () => {
  const { light, dark } = cssVariablesResolver(full);
  for (const colour of PASTELS) {
    expect(light[`--mantine-color-${colour}-light`]).toBe(`var(--jat-p-${colour})`);
    expect(light[`--mantine-color-${colour}-light-color`]).toBe(`var(--jat-i-${colour})`);
    expect(dark[`--mantine-color-${colour}-light`]).toMatch(/^color-mix/);
  }
  expect(light["--mantine-color-text"]).toBe("var(--jat-ink)");
});

test("the plum filled button carries the gradient; other buttons don't", () => {
  render(
    <MantineProvider theme={theme}>
      <Button>Plum</Button>
      <Button color="red">Red</Button>
      <Button variant="light">Light</Button>
    </MantineProvider>,
  );
  expect(screen.getByRole("button", { name: "Plum" })).toHaveClass(String(classes.plum));
  expect(screen.getByRole("button", { name: "Red" })).not.toHaveClass(String(classes.plum));
  expect(screen.getByRole("button", { name: "Light" })).not.toHaveClass(String(classes.plum));
  expect(screen.getByRole("button", { name: "Red" })).toHaveClass(String(classes.button));
});

test("table headers carry the eyebrow class", () => {
  render(
    <MantineProvider theme={theme}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Stage</Table.Th>
          </Table.Tr>
        </Table.Thead>
      </Table>
    </MantineProvider>,
  );
  expect(screen.getByRole("columnheader", { name: "Stage" })).toHaveClass(String(classes.th));
});

test("a header row that names records keeps plain headers", () => {
  render(
    <MantineProvider theme={theme}>
      <Table>
        <Table.Thead data-records>
          <Table.Tr>
            <Table.Th>Example Co</Table.Th>
          </Table.Tr>
        </Table.Thead>
      </Table>
    </MantineProvider>,
  );
  // The eyebrow's rules are scoped to thead:not([data-records]), so this row opts out of them.
  expect(screen.getByRole("columnheader", { name: "Example Co" }).closest("thead")).toHaveAttribute(
    "data-records",
  );
  expect(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "theme.module.css"), "utf8")).not.toMatch(
    /(^|[\s,])thead \.th/m,
  );
});

test("dark mode's lavender button reads with dark text (4.5:1)", () => {
  expect(contrast("#c9b8f0", "#000000")).toBeGreaterThanOrEqual(4.5);
  expect(contrast("#d9cdf6", "#000000")).toBeGreaterThanOrEqual(4.5);
  expect(tokens).toContain("--jat-plum-gradient: linear-gradient(180deg, #d9cdf6, #c9b8f0);");
});

test("a primary checkbox's tick takes the primary's contrast colour, not white", () => {
  render(
    <MantineProvider theme={theme}>
      <Checkbox label="Plain" defaultChecked />
      <Checkbox label="Teal" color="teal" defaultChecked />
    </MantineProvider>,
  );
  const root = (name: string) => screen.getByLabelText(name).closest("[style]") as HTMLElement;
  expect(root("Plain").style.getPropertyValue("--checkbox-icon-color")).toBe(
    "var(--mantine-primary-color-contrast)",
  );
  expect(root("Teal").style.getPropertyValue("--checkbox-icon-color")).not.toBe(
    "var(--mantine-primary-color-contrast)",
  );
});

test("a dropdown's options carry the class that writes in the primary's contrast colour", () => {
  render(
    <MantineProvider theme={theme}>
      <Select label="Pick" data={["One", "Two"]} dropdownOpened />
    </MantineProvider>,
  );
  for (const option of screen.getAllByRole("option", { hidden: true })) {
    expect(option).toHaveClass(String(classes.option));
  }
});

// The values in tokens.css's dark block, a hex or an rgb() with an alpha, laid over a background as a hex.
const darkTokens = tokens.split(":root[data-mantine-color-scheme")[1]!;
const darkOver = (name: string, bg: string) => {
  const value = new RegExp(`--jat-${name}: ([^;]+);`).exec(darkTokens)?.[1];
  if (!value) throw new Error(`no dark --jat-${name}`);
  if (value.startsWith("#")) return value;
  const [r, g, b, a] = /rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(value)!.slice(1).map(Number);
  const hex = "#" + [r!, g!, b!].map((c) => c.toString(16).padStart(2, "0")).join("");
  return over(hex, a!, bg);
};
// Dark mode's card, and the dialog's body behind its boxes.
const [darkCard, darkBody] = [full.colors.dark[6], full.colors.dark[7]];

test("the outline of a box you type in or tick is 3:1 on the card, a dialog and every tint, light and dark", () => {
  for (const bg of ["#ffffff", ...tints("light")]) {
    expect(contrast(token("input-border"), bg), bg).toBeGreaterThanOrEqual(3);
  }
  for (const bg of [darkCard, darkBody, ...tints("dark")]) {
    expect(contrast(darkOver("input-border", bg), bg), bg).toBeGreaterThanOrEqual(3);
  }
});

test("red actions read red at 4.5:1 on the card, every tint and their hover, light and dark", () => {
  const { light } = cssVariablesResolver(full);
  const red = light["--mantine-color-red-text"]!;
  for (const bg of ["#ffffff", token("danger-hover"), ...tints("light")]) {
    expect(contrast(red, bg), bg).toBeGreaterThanOrEqual(4.5);
  }
  // Dark mode's red text is Mantine's red-4.
  const darkRed = DEFAULT_THEME.colors.red[4];
  for (const bg of [darkCard, darkBody, ...tints("dark")]) {
    expect(contrast(darkRed, bg), bg).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkRed, darkOver("danger-hover", bg)), `hover on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  // And a red action is visibly red, not the maroon ink a red badge has on its pastel.
  expect(red).not.toBe("var(--jat-i-red)");
});

test("subtle, outline and transparent red actions take the red text; a red badge keeps its ink on its pastel", () => {
  const resolve = (variant: string) => variantColorResolver({ color: "red", variant, theme: full });
  const mantine = (variant: string) => defaultVariantColorsResolver({ color: "red", variant, theme: full });
  for (const variant of ["subtle", "outline", "transparent"]) {
    expect(resolve(variant).color, variant).toBe("var(--mantine-color-red-text)");
  }
  for (const variant of ["subtle", "outline"]) {
    expect(resolve(variant).hover, variant).toBe("var(--jat-danger-hover)");
  }
  // A transparent action has no hover fill, and only the outline one draws a border.
  expect(resolve("transparent").hover).toBe(mantine("transparent").hover);
  expect(resolve("outline").border).toBe("1px solid var(--mantine-color-red-text)");
  expect(resolve("subtle").border).toBe(mantine("subtle").border);
  // Filled and light red are Mantine's own (light is the pastel and its ink).
  expect(resolve("filled")).toEqual(mantine("filled"));
  expect(resolve("light")).toEqual(mantine("light"));
  expect(resolve("light").color).toBe("var(--mantine-color-red-light-color)");
  expect(variantColorResolver({ color: "plum", variant: "subtle", theme: full }).color).toBe(
    "var(--mantine-color-plum-light-color)",
  );
});

test("text on a table row you point at reads at 4.5:1, light and dark", () => {
  const { light } = cssVariablesResolver(full);
  const row = token("row-hover");
  expect(contrast(token("ink"), row)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(over(token("ink"), 0.7, row), row)).toBeGreaterThanOrEqual(4.5);
  for (const colour of ["orange", "red", "yellow", "green", "teal", "blue"]) {
    expect(contrast(light[`--mantine-color-${colour}-text`]!, row), colour).toBeGreaterThanOrEqual(4.5);
  }
  const darkRow = darkOver("row-hover", darkCard);
  expect(contrast(full.colors.dark[2], darkRow)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(DEFAULT_THEME.colors.red[4], darkRow)).toBeGreaterThanOrEqual(4.5);
});

test("a one-line box's hint sits under the box, so boxes side by side line up; a big text box's stays above", () => {
  render(
    <MantineProvider theme={theme}>
      <TextInput label="Company" description="Pick one" />
      <Textarea label="Notes" description="What they said" />
    </MantineProvider>,
  );
  const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const company = screen.getByLabelText("Company");
  expect(follows(company, screen.getByText("Pick one"))).toBe(true);
  // The box's own wrapper carries the class that gives it an outline you can see.
  expect(company.closest(".mantine-Input-wrapper")).toHaveClass(String(classes.input));
  expect(follows(screen.getByLabelText("Notes"), screen.getByText("What they said"))).toBe(false);
});

test("a dialog is a lifted card with a card's title, under the see-through plum", () => {
  render(
    <MantineProvider theme={theme}>
      <Modal opened onClose={() => {}} title="New application">
        Body
      </Modal>
    </MantineProvider>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveClass("mantine-Modal-content", String(classes.dialogContent));
  expect(screen.getByRole("heading", { name: "New application" })).toHaveClass(String(classes.dialogTitle));
  const root = document.querySelector(".mantine-Modal-root") as HTMLElement;
  expect(root).toHaveClass(String(classes.dialog));
  expect(root.style.getPropertyValue("--mb-padding")).toBe("var(--jat-dialog-padding)");
  const overlay = document.querySelector(".mantine-Modal-overlay") as HTMLElement;
  expect(overlay.style.getPropertyValue("--overlay-bg")).toContain("var(--jat-overlay)");
});

test("a red menu item (Delete) carries the class that draws it in the red that reads", async () => {
  render(
    <MantineProvider theme={theme}>
      <Menu opened>
        <Menu.Target>
          <button type="button">More</button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item color="red">Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </MantineProvider>,
  );
  const item = await screen.findByRole("menuitem", { name: "Delete", hidden: true });
  expect(item).toHaveClass(String(classes.menuItem));
  // The class swaps the shade Mantine paints a red item in for the red text, on the item itself.
  expect(item.style.getPropertyValue("--menu-item-color")).toBe("var(--mantine-color-red-6)");
});

test("a dropdown opens below its box's hint, so the list never covers it", () => {
  document.body.innerHTML =
    '<div><input id="company" /><p id="company-description">New company: it\'s added for you</p></div>';
  const box = document.getElementById("company")!;
  const hint = document.getElementById("company-description")!;
  const rect = (top: number, height: number) => ({ top, bottom: top + height, height }) as DOMRect;
  box.getBoundingClientRect = () => rect(100, 36);
  hint.getBoundingClientRect = () => rect(140, 18);
  // The hint ends 22 px under the box; the list opens 8 px past it.
  expect(clearHint({ elements: { reference: box }, placement: "bottom-start" })).toBe(30);
  // Above the box, or for a box without a hint, the usual 8 px.
  expect(clearHint({ elements: { reference: box }, placement: "top" })).toBe(8);
  hint.remove();
  expect(clearHint({ elements: { reference: box }, placement: "bottom" })).toBe(8);
  const select = full.components.Select?.defaultProps as { comboboxProps?: { offset?: unknown } };
  expect(select.comboboxProps?.offset).toBe(clearHint);
});
