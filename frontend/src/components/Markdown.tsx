import { Typography } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { READING_WIDTH } from "./Page";

/**
 * Render a note's Markdown (GitHub flavoured: tables, task lists, strikethrough).
 * Raw HTML in notes is shown as text, never run, and links open in a new tab.
 * Lines stop at a readable width, however wide the page.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <Typography maw={READING_WIDTH}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {text}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </Typography>
  );
}
