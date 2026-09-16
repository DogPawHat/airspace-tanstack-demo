import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'airspace notes' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const queryClient = Route.useRouteContext().queryClient
  return (
    <QueryClientProvider client={queryClient}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </QueryClientProvider>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <nav>
          <a href="/">notes</a> · <a href="/drafts">drafts</a> ·{' '}
          <a href="/profile">profile</a>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
