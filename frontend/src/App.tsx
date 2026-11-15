import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

import { MantineProvider, mergeThemeOverrides, type MantineThemeOverride } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { router as defaultRouter } from "./router";
import { themeFor } from "./theme";
import { dayjsLocale } from "./utils/format";

export function App({
  router = defaultRouter,
  design,
}: {
  router?: typeof defaultRouter;
  /** DEV ONLY: a redesign concept's theme on top of the app's (main.tsx). */
  design?: MantineThemeOverride;
}) {
  // Calendars' month and day names follow the chosen language (its dayjs locale); weeks start
  // on Monday. TODO(multi-language): the first day of the week per locale (docs/rfc/i18n.md §7).
  const { i18n } = useTranslation();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } } }),
  );
  const theme = useMemo(
    () => (design ? mergeThemeOverrides(themeFor(i18n.language), design) : themeFor(i18n.language)),
    [i18n.language, design],
  );
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: dayjsLocale(i18n.language), firstDayOfWeek: 1 }}>
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
