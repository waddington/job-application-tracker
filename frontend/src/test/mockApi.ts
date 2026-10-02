import { vi } from "vitest";

type Handler = (url: URL, init: RequestInit | undefined) => unknown;

/** Replace fetch with a tiny router over path → JSON response. Returns the recorded calls. */
export function mockApi(routes: Record<string, unknown | Handler>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), "http://localhost");
    const method = (request?.method ?? init?.method ?? "GET").toUpperCase();
    const rawBody = request ? await request.clone().text() : (init?.body as string | undefined);
    const body = rawBody ? JSON.parse(rawBody) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });
    const key = `${method} ${url.pathname}`;
    const route = routes[key] ?? routes[url.pathname];
    if (route === undefined) {
      return new Response(JSON.stringify({ detail: `no mock for ${key}` }), { status: 404 });
    }
    const data = typeof route === "function" ? (route as Handler)(url, { ...init, body: rawBody }) : route;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

export const WORKFLOW = {
  initial: "interested",
  transitions: "configured",
  skip_forward: true,
  reopen_from: ["ghosted"],
  stages: [
    {
      id: "interested",
      name: "Interested",
      kind: "active",
      stale_after_days: 14,
      color: "gray",
      next: ["applied"],
      allowed_next: ["applied", "rejected"],
      suggested_next: ["applied", "rejected"],
    },
    {
      id: "applied",
      name: "Applied",
      kind: "active",
      stale_after_days: 7,
      color: "blue",
      next: ["screen"],
      allowed_next: ["screen", "rejected"],
      suggested_next: ["screen", "rejected"],
    },
    {
      id: "screen",
      name: "Screen",
      kind: "active",
      stale_after_days: 5,
      color: "cyan",
      next: [],
      allowed_next: ["rejected"],
      suggested_next: ["rejected"],
    },
    {
      id: "rejected",
      name: "Rejected",
      kind: "closed",
      stale_after_days: null,
      color: "red",
      next: [],
      allowed_next: [],
      suggested_next: [],
    },
  ],
};

export function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    role_id: "r1",
    route: "agency",
    agency_id: "ag1",
    recruiter_id: "c1",
    stage: "applied",
    applied_on: "2026-09-20",
    follow_up_on: null,
    snoozed_until: null,
    last_activity_at: "2026-09-20T10:00:00Z",
    tags: ["python"],
    archived: false,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    role_title: "Backend Engineer",
    company_id: "co1",
    company_name: "Contoso",
    agency_name: "Northwind Talent",
    recruiter_name: "Alex Recruiter",
    stage_name: "Applied",
    stage_kind: "active",
    days_since_activity: 10,
    stale: true,
    ...overrides,
  };
}

/** A Timeline entry (an application's logged call, by default). */
export const item = (overrides: Record<string, unknown> = {}) => ({
  id: "event:e1",
  at: "2026-10-01T09:30:00Z",
  all_day: false,
  category: "message",
  title: "Call with Alex",
  detail: null,
  application_id: "a1",
  role_title: "Backend Engineer",
  company_id: "co1",
  company_name: "Contoso",
  agency_id: "ag1",
  agency_name: "Northwind Talent",
  people: [{ id: "c1", name: "Alex Recruiter" }],
  archived: false,
  ...overrides,
});

/** A role from /role-summaries (a role still to decide at Contoso, by default). */
export const roleSummary = (overrides: Record<string, unknown> = {}) => ({
  id: "r1",
  company_id: "co1",
  title: "Backend Engineer",
  url: null,
  location: null,
  work_mode: null,
  employment_type: null,
  salary_min: null,
  salary_max: null,
  currency: null,
  day_rate: null,
  ir35: null,
  description: null,
  contact_id: null,
  meeting_id: null,
  decision: null,
  decision_reason: null,
  decided_on: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  company_name: "Contoso",
  status: "to_decide",
  application_ids: [],
  contact_name: null,
  agency_id: null,
  agency_name: null,
  meeting_label: null,
  ...overrides,
});

/** A call from /meetings (booked with Alex Morgan in two days, by default). */
export const meeting = (overrides: Record<string, unknown> = {}) => ({
  id: "m1",
  contact_id: "c1",
  application_id: null,
  kind: "call",
  title: "Market catch-up",
  status: "scheduled",
  starts_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  ends_at: null,
  location: null,
  meeting_url: null,
  agenda: null,
  notes: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  label: "Call with Alex Morgan: Market catch-up",
  contact_name: "Alex Morgan",
  agency_id: "ag1",
  agency_name: "Northwind Talent",
  company_id: null,
  company_name: null,
  role_title: null,
  application_company_name: null,
  ...overrides,
});

/** A to-do from /todos (open, about Alex Morgan, no date, by default). */
export const todo = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  text: "Reply to their message",
  due_on: null,
  done_at: null,
  entity_type: "contact",
  entity_id: "c1",
  about: "Alex Morgan",
  company_id: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...overrides,
});
