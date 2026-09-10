import type { QueryClient } from "@tanstack/react-query";

const PREFETCH: Record<string, { key: unknown[]; url: string }> = {
  "/dashboard": { key: ["dashboard-summary"], url: "/api/v1/dashboard/summary" },
  "/products": { key: ["products", ""], url: "/api/v1/products?q=" },
  "/recipes": { key: ["recipes"], url: "/api/v1/recipes" },
  "/warehouse": { key: ["stock", ""], url: "/api/v1/stock" },
  "/inventory": {
    key: ["inventory-counts"],
    url: "/api/v1/inventory-counts",
  },
  "/orders": { key: ["purchase-orders"], url: "/api/v1/purchase-orders" },
  "/suppliers": { key: ["suppliers"], url: "/api/v1/suppliers" },
  "/goods-receipt": {
    key: ["goods-receipts"],
    url: "/api/v1/goods-receipts",
  },
  "/reports": { key: ["reports", 30], url: "/api/v1/reports/summary?days=30" },
  "/users": { key: ["users"], url: "/api/v1/users" },
  "/food-waste": { key: ["waste"], url: "/api/v1/waste" },
  "/breakfast": { key: ["breakfast"], url: "/api/v1/breakfast" },
  "/minibar": { key: ["minibar", ""], url: "/api/v1/minibar" },
  "/settings": { key: ["settings"], url: "/api/v1/settings" },
};

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("prefetch failed");
  return res.json();
}

/** Warm TanStack Query cache for a sidebar route (hover / focus). */
export function prefetchNavRoute(queryClient: QueryClient, href: string) {
  const entry = PREFETCH[href];
  if (!entry) return;
  void queryClient.prefetchQuery({
    queryKey: entry.key,
    queryFn: () => fetchJson(entry.url),
  });
}
