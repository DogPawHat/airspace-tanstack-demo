import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { accountQuery } from "../queries.ts";

export const Route = createFileRoute("/_authenticated")({
  context: () => {
    return { accountOptions: accountQuery() };
  },
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.query(context.accountOptions);
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: Outlet,
});
