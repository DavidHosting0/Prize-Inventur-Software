"use client";

import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { PwaRegister } from "./pwa-register";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Short stale window: nav feels instant via prefetch, data stays fresh
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            placeholderData: keepPreviousData,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
          },
        },
      })
  );
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <QueryClientProvider client={client}>
        <PwaRegister />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
