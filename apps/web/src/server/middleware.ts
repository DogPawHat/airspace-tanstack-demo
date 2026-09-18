import { createMiddleware } from "@tanstack/react-start";

import { requireAccount, UnauthorizedError, useDemoAirspace } from "./demo.ts";

export const requireAccountMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const account = await requireAccount().catch((error: unknown) => {
      if (error instanceof UnauthorizedError) {
        throw Response.json(
          { error: "Unauthorized", message: error.message },
          {
            status: 401,
            headers: { "WWW-Authenticate": "Session" },
          },
        );
      }

      throw error;
    });
    const airspace = await useDemoAirspace(account);

    return next({ context: { account, airspace } });
  },
);
