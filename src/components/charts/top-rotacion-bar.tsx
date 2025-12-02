"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Cell } from "recharts";

export function TopRotacionBar({
  data,
  loading,
}: {
  data: any[];
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-slate-100" />;

  const palette = ["#0ea5e9", "#6366f1", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];

  return (
    <ResponsiveContainer width="100%" height={280}>
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
          radius={[10, 10, 0, 0]}
        >
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={palette[i % palette.length]} opacity={0.9} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
