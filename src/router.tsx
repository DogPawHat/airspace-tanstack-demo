import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen.ts'

export function getRouter() {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
