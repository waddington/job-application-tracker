import { Typography } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Render a note's Markdown (GitHub flavoured: tables, task lists, strikethrough).
 * Raw HTML in notes is shown as text, never run, and links open in a new tab.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <Typography>
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
