import type { ReactNode } from "react";

import classes from "./RecordLayout.module.css";

/**
 * A record's page body (an application's, a company's…; docs/rfc/app-redesign.md §2, Pages): on a wide page the
 * main cards in two columns and the side cards (to-dos, the role, people) in a narrower third, under a summary that
 * spans the top. It lays out by the page's own width, so beside the docked panel it uses the room that's left:
 * the main cards in one column beside the side ones at mid widths, and everything stacked when narrow, in the
 * order summary, main (first column, then second), side. That's also the order Tab goes in.
 *
 * Each slot takes its cards as they are; they keep their natural height. `main` is one or two columns' worth.
 */
export function RecordLayout({
  summary,
  main,
  side,
}: {
  summary?: ReactNode;
  main: readonly [ReactNode, ReactNode?];
  side?: ReactNode;
}) {
  const [first, second] = main;
  return (
    <div className={classes.room}>
      <div className={classes.layout} data-record-layout>
        {summary && (
          <div className={classes.summary} data-record-part="summary">
            {summary}
          </div>
        )}
        <div className={classes.mains}>
          <div className={classes.column} data-record-part="main">
            {first}
          </div>
          {second && (
            <div className={classes.column} data-record-part="main-2">
              {second}
            </div>
          )}
        </div>
        {side && (
          <div className={classes.column} data-record-part="side">
            {side}
          </div>
        )}
      </div>
    </div>
  );
}
