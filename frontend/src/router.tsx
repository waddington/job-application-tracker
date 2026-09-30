import { createRootRoute, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import type { JSX } from "react";

import { Layout } from "./components/Layout";
import { NAV } from "./nav";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

// Pages that are built; everything else in NAV shows its "coming soon" placeholder.
const PAGES: Record<string, () => JSX.Element> = {
  "/applications": ApplicationsPage,
};

const pageRoutes = NAV.map((item) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: item.path,
    component: PAGES[item.path] ?? (() => <Placeholder item={item} />),
  }),
);

const routeTree = rootRoute.addChildren(pageRoutes);

export function makeRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history, defaultPreload: "intent" });
}

export const router = makeRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
