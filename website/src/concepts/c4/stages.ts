// The stages the page walks through, in order. Journey.astro writes a chapter per stage; the fixed
// tracker and the spine's nodes follow the same list.
export const STAGES = [
  { id: "interested", name: "Interested", tint: "navy" },
  { id: "applied", name: "Applied", tint: "navy" },
  { id: "screen", name: "Screen", tint: "teal" },
  { id: "interview", name: "Interview", tint: "teal" },
  { id: "offer", name: "Offer", tint: "violet" },
  { id: "picture", name: "Insights", tint: "violet" },
] as const;
