import dayjs from "dayjs";
import { useEffect, useState } from "react";

const localDay = () => dayjs().format("YYYY-MM-DD");

/** Your local date, updated when the clock passes midnight (so an open tab rolls over). */
export function useToday() {
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDay()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
