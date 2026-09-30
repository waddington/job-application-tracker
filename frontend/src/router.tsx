import { createRootRoute, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import type { JSX } from "react";

import { Layout } from "./components/Layout";
import { NAV } from "./nav";
import { ApplicationPage } from "./pages/ApplicationPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { CompaniesPage } from "./pages/CompaniesPage";
import { CompanyPage } from "./pages/CompanyPage";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

// Pages that are built; everything else in NAV shows its "coming soon" placeholder.
const PAGES: Record<string, () => JSX.Element> = {
  "/applications": ApplicationsPage,
  "/companies": CompaniesPage,
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

const routeTree = rootRoute.addChildren([...pageRoutes, applicationRoute, companyRoute]);

export function makeRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: "intent" });
}

export const router = makeRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
