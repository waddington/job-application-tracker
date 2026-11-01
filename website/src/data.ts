// The landing page's words in one place, so the page and its structured data (JSON-LD) agree.
// Keep them honest: only what's merged, and the status as the README gives it.

export const REPO = "https://github.com/waddington/job-application-tracker";
export const SITE_URL = "https://waddington.github.io/job-application-tracker/";
// The user guide lives on GitHub; the site links to it.
export const GUIDE = `${REPO}/blob/main/docs/guide/`;
// The <title> and meta description: the words people search for first ("free", "private",
// "job application tracker"), then what sets it apart. Keep the description near 160 characters.
export const TITLE = "Free Job Application Tracker: private, no sign-up, open source";
export const DESCRIPTION =
  "A free, private job application tracker. Track applications, recruiters, interviews, follow-ups and offers on your own computer. No account, no cloud, no tracking.";

export const ROTATING = ["application", "recruiter", "interview round", "follow-up", "offer", "ghosting"];

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
    a: "Not yet: it runs on Mac and Linux. Windows support is next on the roadmap.",
  },
  {
    q: "Does it work on my phone?",
    a: "No. It runs on your computer and you use it in your computer's browser.",
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
    a: "Python 3.12+ with uv, Node.js 22.12+ with pnpm to build the web UI, and optionally git for automatic snapshots (`jat push` sends them to your private remote). The user guide covers a second computer and every command.",
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

export const STACK = [
  "Python 3.12",
  "uv",
  "FastAPI",
  "SQLAlchemy",
  "Alembic",
  "SQLite",
  "React 19",
  "TypeScript",
  "Mantine",
  "TanStack",
  "d3-sankey",
  "Vite",
];
