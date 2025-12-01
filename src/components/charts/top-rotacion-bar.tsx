"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function TopRotacionBar({
  data,
  loading,
}: {
  data: any[];
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-slate-100" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeOpacity={0.12} vertical={false} />
        <XAxis dataKey="codigo" tick={{ fontSize: 11 }} stroke="#64748b" />
        <YAxis stroke="#64748b" />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
          itemStyle={{ color: "#0f172a" }}
        />
        <Bar
          dataKey="rotacion"
          fill="var(--chart-1)"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
