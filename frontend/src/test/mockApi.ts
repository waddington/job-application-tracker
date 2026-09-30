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
