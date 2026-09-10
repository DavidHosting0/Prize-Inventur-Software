"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardBody, CardHeader } from "@prize/ui";

type RevenuePoint = { date: string; amount: number };
type TopProduct = { name: string; revenue: number };

export function DashboardCharts({
  revenueSeries,
  topProducts,
  revenueTitle,
  topTitle,
}: {
  revenueSeries: RevenuePoint[];
  topProducts: TopProduct[];
  revenueTitle: string;
  topTitle: string;
}) {
  return (
    <div className="grid gap-3 desktop:grid-cols-3">
      <Card className="desktop:col-span-2">
        <CardHeader>
          <div className="text-sm font-semibold">{revenueTitle}</div>
        </CardHeader>
        <CardBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                fill="url(#rev)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">{topTitle}</div>
        </CardHeader>
        <CardBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  );
}
