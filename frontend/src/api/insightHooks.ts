import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Flow = Schemas["FlowOut"];
export type FlowNode = Schemas["FlowNode"];
export type FlowLink = Schemas["FlowLink"];
export type Stats = Schemas["StatsOut"];
export type Week = Schemas["WeekOut"];

export interface FlowFilters {
  since?: string;
  route?: "direct" | "agency" | "referral";
}

/** Stage-to-stage flows for applications added since `since` (and by `route`). */
export function useFlow(filters: FlowFilters) {
  return useQuery({
    queryKey: ["insights", "flow", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/insights/flow", { params: { query: filters } })),
    placeholderData: keepPreviousData, // keep the diagram up while a filter change loads
  });
}

/** Everything in one flow: where roles came from, through passed, deciding and every stage. */
export function useWholeFlow(since?: string) {
  return useQuery({
    queryKey: ["insights", "whole-flow", since],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/insights/whole-flow", { params: { query: { since } } })),
    placeholderData: keepPreviousData,
  });
}

/** Conversion and time per stage, and outcomes by route, for applications added since `since`. */
export function useStats(since?: string) {
  return useQuery({
    queryKey: ["insights", "stats", since],
    queryFn: async () => unwrap(await api.GET("/api/v1/insights/stats", { params: { query: { since } } })),
    placeholderData: keepPreviousData,
  });
}

/** Activity per week, oldest first: `start` is the first week's Monday, `tz` your IANA time zone. */
export function useActivity(start: string, weeks: number, tz: string) {
  return useQuery({
    queryKey: ["insights", "activity", start, weeks, tz],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/insights/activity", { params: { query: { start, weeks, tz } } })),
  });
}

export type Scorecard = Schemas["ScorecardOut"];
export type Score = Schemas["ScoreOut"];

/** How each recruiter's and agency's roles have gone, for applications added since `since`. */
export function useScorecard(since?: string) {
  return useQuery({
    queryKey: ["insights", "scorecard", since],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/insights/scorecard", { params: { query: { since } } })),
    placeholderData: keepPreviousData,
  });
}

export type Rescheduling = Schemas["ReschedulingOut"];
export type RescheduledNamed = Schemas["RescheduledNamed"];

/** How many booked rounds moved and who needed it, for applications added since `since`. */
export function useRescheduling(since?: string) {
  return useQuery({
    queryKey: ["insights", "rescheduling", since],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/insights/rescheduling", { params: { query: { since } } })),
    placeholderData: keepPreviousData,
  });
}

export type Conversations = Schemas["ConversationsOut"];
export type ConversationPerson = Schemas["ConversationPerson"];
export type ConversationAgency = Schemas["ConversationAgency"];

/** Calls with people and the roles they pitched (added since `since`), and how those went. */
export function useConversations(since?: string) {
  return useQuery({
    queryKey: ["insights", "conversations", since],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/insights/conversations", { params: { query: { since } } })),
    placeholderData: keepPreviousData,
  });
}

export type DocumentsPerformance = Schemas["DocumentsOut"];
export type DocumentKindPerformance = Schemas["DocumentKindPerformance"];
export type DocumentTally = Schemas["DocumentTally"];

/** CV and cover-letter versions compared, for applications added since `since` (and by `route`). */
export function useDocumentPerformance(filters: FlowFilters) {
  return useQuery({
    queryKey: ["insights", "documents", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/insights/documents", { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
}
