// The project's website: one landing page (src/pages/index.astro), served by GitHub Pages.
// The docs stay on GitHub (docs/guide); the page links to them.
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://waddington.github.io",
  base: "/job-application-tracker",
  trailingSlash: "always",
  integrations: [sitemap()],
  // Concepts branch only: the dev toolbar sat under the concept switcher.
  devToolbar: { enabled: false },
});
