import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { i18n } from "../i18n";
import { formatMoney } from "../utils/format";
import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type Offer = Schemas["OfferOut"];
export type OfferBody = Schemas["OfferIn"];
export type OfferStatus = Offer["status"];

export const OFFER_STATUS: Record<OfferStatus, { label: `offers:status.${OfferStatus}`; color: string }> = {
  pending: { label: "offers:status.pending", color: "yellow" },
  accepted: { label: "offers:status.accepted", color: "green" },
  declined: { label: "offers:status.declined", color: "gray" },
  withdrawn: { label: "offers:status.withdrawn", color: "red" },
};

export interface OfferFilters {
  application_id?: string;
  status?: OfferStatus;
  latest?: boolean;
}

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

export function useOffers(filters: OfferFilters) {
  return useQuery({
    queryKey: ["offers", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/offers", { params: { query: filters } })),
  });
}

function useRefreshOffers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["offers"] });
    invalidateApplicationViews(qc); // the timeline logs offers; Today lists reply deadlines
  };
}

export function useSaveOffer() {
  const refresh = useRefreshOffers();
  return useMutation({
    mutationFn: async (
      args: { id: string; body: Partial<OfferBody> } | { applicationId: string; body: OfferBody },
    ) =>
      "id" in args
        ? unwrap(
            await api.PATCH("/api/v1/offers/{offer_id}", {
              params: { path: { offer_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(
            await api.POST("/api/v1/applications/{app_id}/offers", {
              params: { path: { app_id: args.applicationId } },
              body: args.body,
            }),
          ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteOffer() {
  const refresh = useRefreshOffers();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/offers/{offer_id}", { params: { path: { offer_id: id } } });
      if (error) throw new Error("Couldn't delete the offer");
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}

/** "£85,000" or "85,000 CHF": the currency is the offer's own, the digits follow the language. */
export function money(n: number | null | undefined, currency: string | null | undefined) {
  return formatMoney(n, currency, i18n.language);
}

/** The headline figure: "£85,000 a year" or "£650 a day". */
export function headline(o: Offer) {
  if (o.value_basis === "day rate") {
    return i18n.t("offers:headline.perDay", { amount: money(o.day_rate, o.currency) });
  }
  if (o.salary != null) return i18n.t("offers:headline.perYear", { amount: money(o.salary, o.currency) });
  return i18n.t("offers:headline.none");
}
