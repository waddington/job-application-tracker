import { useMediaQuery } from "@mantine/hooks";

/** Below 768 px (Mantine's sm): the bottom bar in place of the side menu. The CSS files write the same query. */
export const PHONE_QUERY = "not all and (min-width: 48em)";

/** Whether the window is a phone's width, right from the first render. */
export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false });
}
