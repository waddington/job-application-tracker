// The landing page's words in one place, so the page and its structured data (JSON-LD) agree.
// Keep them honest: only what's merged, and the status as the README gives it.

export const REPO = "https://github.com/waddington/job-application-tracker";
export const SITE_URL = "https://waddington.github.io/job-application-tracker/";
// The user guide lives on GitHub; the site links to it.
export const GUIDE = `${REPO}/blob/main/docs/guide/`;
// The README in Simplified Chinese, for Chinese readers.
export const README_ZH = `${REPO}/blob/main/README.zh-CN.md`;
// The <title> and meta description: the words people search for first ("free", "private", "job application
// tracker" in the title and the h1, "job search tracker" in the description), then what sets it apart. Keep the
// description near 160 characters.
export const TITLE = "Free Job Application Tracker: private, no sign-up, open source";
export const DESCRIPTION =
  "A free, private job search tracker. Track applications, recruiters, interviews, follow-ups and offers on your own computer. No cloud, no account, no tracking.";

export const MARQUEE = [
  [
    "Kanban board",
    "Recruiter CRM",
    "Interview rounds",
    "Sankey funnel",
    "Offers side by side",
    "Today page",
    "Timeline",
    "To-dos",
  ],
  [
    "Markdown notes",
    "CV versions",
    ".eml import",
    "Full-text search",
    "Duplicate warnings",
    "Git snapshots",
    "Roles to decide",
    "Recruiter scorecard",
  ],
];

export const STATS = [
  { value: 0, suffix: "", label: "accounts to create" },
  { value: 0, suffix: "", label: "trackers or ads" },
  { value: 0, suffix: "", label: "subscription fees" },
  { value: 100, suffix: "%", label: "of your data on your computer" },
];

// Chinese words in English text get lang="zh-CN", so screen readers say them in Chinese. Give it
// escaped text only, never markup: it would wrap Chinese inside an attribute too.
const markZh = (text: string) => text.replace(/[\u4e00-\u9fff]+/g, '<span lang="zh-CN">$&</span>');

// FAQ answers may hold `code` and [links](https://…): `faqHtml` shows them (both pages' FAQ), and `plain`
// strips them for the structured data.
export const plain = (a: string) => a.replaceAll("`", "").replace(/\[([^\]]+)\]\(https:\/\/[^)\s]+\)/g, "$1");

// `code` becomes <code>, and [text](https://…) a link. Chinese words get lang="zh-CN" in the text and link
// text only, never inside code or an address.
const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export const faqHtml = (a: string) =>
  a
    .split(/(`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/)
    .map((part) => {
      const code = part.match(/^`([^`]+)`$/);
      if (code) return `<code>${escape(code[1])}</code>`;
      const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
      if (link) return `<a href="${escape(link[2])}">${markZh(escape(link[1]))}</a>`;
      return markZh(escape(part));
    })
    .join("");

// The footer's small print, on both pages.
export const FOOTER_NOTE =
  "Screenshots show made-up demo data. Hosted on GitHub Pages; this site adds no cookies, analytics or trackers.";

// The quick start's steps. The install and demo commands match the README and the install guide (which gives
// the two pnpm steps a line each). "Use it for real" follows the README; the guide splits it between
// install.md and your-data.md. Keep them in step.
// `copy: false` leaves a command out of Copy, which copies only what runs as pasted, in order; `before` is a
// comment shown above a command.
export type QuickLine = {
  cmd?: string;
  out?: string;
  note?: string;
  copy?: false;
  before?: string;
};
export const QUICKSTART: { id: string; label: string; lines: QuickLine[] }[] = [
  {
    id: "install",
    label: "1 · Install",
    lines: [
      { cmd: "git clone https://github.com/waddington/job-application-tracker.git" },
      { cmd: "cd job-application-tracker" },
      { cmd: "uv sync" },
      { cmd: "pnpm --dir frontend install && pnpm --dir frontend build" },
      { out: "✓ built the web UI into frontend/dist" },
    ],
  },
  {
    id: "demo",
    label: "2 · Try it with demo data",
    lines: [
      { note: "# made-up companies and people; needs a new or empty folder" },
      { cmd: "uv run python scripts/seed_demo.py /tmp/jat-demo" },
      { cmd: "uv run jat --data-dir /tmp/jat-demo serve" },
      { out: "→ http://127.0.0.1:8770" },
    ],
  },
  {
    id: "real",
    label: "3 · Use it for real",
    lines: [
      { cmd: "mkdir -p ~/job-search-data && git -C ~/job-search-data init" },
      {
        cmd: "git -C ~/job-search-data remote add origin <your-private-repo-url>",
        copy: false,
        before: "# optional, for jat push: put your own private repo's URL in",
      },
      { cmd: "cp .env.example .env" },
      { note: "# .env.example already sets JAT_DATA_DIR=~/job-search-data" },
      { cmd: "uv run jat init" },
      { cmd: "uv run jat serve" },
      { out: "→ http://127.0.0.1:8770 (keeps running)" },
      { cmd: "uv run jat push", copy: false, before: "# later, from another terminal" },
      { out: "✓ snapshots sent to your private repo" },
    ],
  },
];
// A step's commands, one per line, for its Copy button: only those that run as pasted.
export const pasteable = (lines: QuickLine[]) =>
  lines
    .filter((l) => l.cmd && l.copy !== false)
    .map((l) => l.cmd)
    .join("\n");

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is it free?",
    a: "Yes. It's open source under the Apache-2.0 licence. No plans, no seats, no trial.",
  },
  {
    q: "Do I need to be technical?",
    a: "A little, for now. Setting it up means installing Node.js and a few small tools (the install guide links to them all), then about ten minutes copying and pasting a few commands into the Terminal app. After that it's a normal web page in your browser. A one-command install and a double-click app are planned.",
  },
  {
    q: "Is it like Huntr or Teal?",
    a: "It does the same job: a board of your applications, the people involved, interviews, follow-ups and offers. The difference is where it lives. Huntr and Teal are websites that keep your job search on their servers, behind an account and often a subscription. This runs on your own computer, free, with nothing to sign up for.",
  },
  {
    q: "Does it use AI?",
    a: "No. Nothing reads, summarises, scores or uploads your notes, CVs or emails.",
  },
  {
    q: "Where is my data stored?",
    a: "In one folder on your own machine that you choose, kept separate from the code: a SQLite database, a readable JSON Lines export, your Markdown notes and your files. Nothing is uploaded anywhere.",
  },
  {
    q: "Does it scrape LinkedIn or job boards?",
    a: "No. By design it tracks the applications you make. It never searches for jobs, never calls out to the web and never contacts anyone.",
  },
  {
    q: "Does it run on Windows?",
    a: "Yes. It runs on Windows, Mac and Linux. On Windows, use Download a backup in the sidebar to keep a complete backup of your data.",
  },
  {
    q: "Does it work on my phone?",
    a: "No. It runs on your computer and you use it in your computer's browser.",
  },
  {
    q: "Is it available in my language?",
    a: `It comes in English and 简体中文 (Simplified Chinese), the whole app from buttons to dates. It follows your browser's language, and you can switch in the header. More languages are welcome: ask in an issue, or add one in a pull request with [the guide to adding a language](${GUIDE}adding-a-language.md). The README is also [in 简体中文](${README_ZH}).`,
  },
  {
    q: "Can I import my spreadsheet?",
    a: "Not yet. You add applications by hand: one short form, where anything new (a company, a recruiter) is created as you type.",
  },
  {
    q: "How do I back it up?",
    a: "Download a backup from the sidebar: one zip file with everything you need to restore. If you're comfortable with git, the folder can also keep its own full history and copy it to a private repo you own.",
  },
  {
    q: "What do developers need to run it?",
    a: "Python 3.12 to 3.14 with uv, Node.js 22.12+ with pnpm to build the web UI, and optionally git for automatic snapshots (`jat push` sends them to your private remote). The user guide covers a second computer and every command.",
  },
  {
    q: "Can I use it for non-software jobs?",
    a: "Yes. It's built with tech hiring in mind (recruiters, coding interviews, take-home tasks), but the stages are yours to change in a settings file.",
  },
  {
    q: "Is it ready?",
    a: "Yes. Every planned feature is built, and it's in daily use for a real job search. Version 1.0 is out, and every release is on GitHub. Issues and pull requests are very welcome.",
  },
  {
    q: "Is it multi-user?",
    a: "No. It's a personal tool for one job seeker, running on localhost.",
  },
];
