import type { ReactNode } from "react";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { DemoShell } from "../components/DemoShell.tsx";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "airspace notes" },
      { name: "theme-color", content: "#f9fafb", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#111721", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono&family=Space+Grotesk:wght@500&display=swap",
      },
      { rel: "stylesheet", href: "/styles/tokens.css" },
      { rel: "stylesheet", href: "/styles/base.css" },
      { rel: "stylesheet", href: "/styles/demo.css" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <DemoShell>
        <Outlet />
      </DemoShell>
    </RootDocument>
  );
}

/** Port of the upstream airspace docs app `SiteShell.vue`. */
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="shell">
          <header className="masthead">
            <div className="masthead-inner">
              <p className="brand">
                <Link to="/" className="wordmark">
                  <span>
                    airspace
                    <svg
                      className="contrail"
                      viewBox="0 0 120 24"
                      aria-hidden="true"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M2 20 C 26 12, 54 22, 82 13 S 112 3, 120 1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="3 5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </span>
                  <svg className="plane" viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M6 22 26 8l-6 16-5-5-4 4v-6z" fill="currentColor" />
                  </svg>
                </Link>
              </p>
              <nav>
                <Link to="/">notes</Link>
                <Link to="/drafts">drafts</Link>
                <Link to="/profile">profile</Link>
              </nav>
            </div>
          </header>

          <main className="wide">{children}</main>

          <footer className="site-footer">
            <p>
              <span>airspace notes demo</span>
              <span>&middot;</span>
              <span>MIT</span>
              <span>&middot;</span>
              <a href="https://github.com/DogPawHat/airspace-tanstack-demo">source</a>
            </p>
          </footer>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
