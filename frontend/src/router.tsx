import { createRootRoute, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";

import { Layout } from "./components/Layout";
import { NAV } from "./nav";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

const pageRoutes = NAV.map((item) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: item.path,
    component: () => <Placeholder item={item} />,
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
