import { createRootRoute, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import type { JSX } from "react";

import { Layout } from "./components/Layout";
import { NAV } from "./nav";
import { AgencyPage } from "./pages/AgencyPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { CompaniesPage } from "./pages/CompaniesPage";
import { CompanyPage } from "./pages/CompanyPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { InsightsPage } from "./pages/InsightsPage";
import { InterviewsPage } from "./pages/InterviewsPage";
import { OffersPage } from "./pages/OffersPage";
import { NotesPage } from "./pages/NotesPage";
import { NextActionsPage } from "./pages/NextActionsPage";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
import { RecruitersPage } from "./pages/RecruitersPage";
import { SearchPage } from "./pages/SearchPage";

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

// Pages that are built; everything else in NAV shows its "coming soon" placeholder.
const PAGES: Record<string, () => JSX.Element> = {
  "/": NextActionsPage,
  "/applications": ApplicationsPage,
  "/companies": CompaniesPage,
  "/documents": DocumentsPage,
  "/insights": InsightsPage,
  "/interviews": InterviewsPage,
  "/offers": OffersPage,
  "/notes": NotesPage,
  "/recruiters": RecruitersPage,
};

const pageRoutes = NAV.map((item) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: item.path,
    component: PAGES[item.path] ?? (() => <Placeholder item={item} />),
  }),
);

const applicationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/applications/$appId",
  component: ApplicationPage,
});

const companyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/companies/$companyId",
  component: CompanyPage,
});

const agencyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agencies/$agencyId",
  component: AgencyPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: SearchPage,
  // ?q= as typed, kept a string (the default parser would turn "2026" into a number).
  validateSearch: (search: Record<string, unknown>) => ({ q: search.q == null ? "" : String(search.q) }),
});

const routeTree = rootRoute.addChildren([
  ...pageRoutes,
  applicationRoute,
  companyRoute,
  agencyRoute,
  searchRoute,
]);

export function makeRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: "intent" });
}

export const router = makeRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
