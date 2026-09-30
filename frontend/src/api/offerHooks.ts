import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type Offer = Schemas["OfferOut"];
export type OfferBody = Schemas["OfferIn"];
export type OfferStatus = Offer["status"];

export const STATUS_LABELS: Record<OfferStatus, { label: string; color: string }> = {
  pending: { label: "Deciding", color: "yellow" },
  accepted: { label: "Accepted", color: "green" },
  declined: { label: "Declined", color: "gray" },
  withdrawn: { label: "Withdrawn", color: "red" },
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
    invalidateApplicationViews(qc); // the timeline logs offers; Next actions lists reply deadlines
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

const SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

/** "£85,000" or "85,000 CHF". */
export function money(n: number | null | undefined, currency: string | null | undefined) {
  if (n == null) return "—";
  const symbol = SYMBOLS[(currency ?? "").toUpperCase()];
  const digits = n.toLocaleString("en-GB");
  return symbol ? `${symbol}${digits}` : `${digits}${currency ? ` ${currency}` : ""}`;
}

/** The headline figure: "£85,000 a year" or "£650 a day". */
export function headline(o: Offer) {
  if (o.value_basis === "day rate") return `${money(o.day_rate, o.currency)} a day`;
  if (o.salary != null) return `${money(o.salary, o.currency)} a year`;
  return "No figures yet";
}
