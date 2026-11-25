"use client";

import { createAuthClient } from "@neon/auth/next";

/** Browser auth client. Talks to /api/auth/*, which proxies to Neon Auth. */
export const authClient = createAuthClient();
