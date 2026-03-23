import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TreasuryData, RWAAllocation } from "../types";

interface Props {
  data: TreasuryData;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Agent Ops": "#a855f7",
  Stewardship: "#f59e0b",
  Infrastructure: "#3b82f6",
  "Security Audits": "#10b981",
};

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: color ?? "#ffffff" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function buildChartData(history: TreasuryData["spendingHistory"]) {
  const byDate: Record<string, Record<string, number>> = {};
  for (const entry of history) {
    if (!byDate[entry.date]) byDate[entry.date] = {};
    byDate[entry.date][entry.category] =
      (byDate[entry.date][entry.category] ?? 0) + entry.amount;
  }
  return Object.entries(byDate).map(([date, cats]) => ({ date, ...cats }));
}

function buildBreakdown(history: TreasuryData["spendingHistory"]) {
  const totals: Record<string, number> = {};
  for (const entry of history) {
    totals[entry.category] = (totals[entry.category] ?? 0) + entry.amount;
  }
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  return Object.entries(totals).map(([cat, amt]) => ({
    category: cat,
    amount: amt,
    pct: Math.round((amt / grand) * 100),
  }));
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs">
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-gray-300">{p.dataKey}:</span>
          <span className="font-bold text-white">{p.value.toFixed(3)} ETH</span>
        </div>
      ))}
    </div>
  );
};

export default function TreasuryDashboard({ data }: Props) {
  const chartData = buildChartData(data.spendingHistory);
  const breakdown = buildBreakdown(data.spendingHistory);
  const categories = Object.keys(CATEGORY_COLORS);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="ETH Balance"
          value={data.balance}
          sub="Active treasury"
          color="#a855f7"
        />
        <StatCard
          label="Yield Balance"
          value={data.yieldBalance}
          sub={`${data.apy} APY via ERC-4626`}
          color="#22c55e"
        />
        <StatCard
          label="Total Raised"
          value={data.totalRaised}
          sub="All-time tips + grants"
          color="#f59e0b"
        />
        <StatCard
          label="Runway"
          value={data.runway}
          sub={`${data.monthlyBurn}/mo burn rate`}
          color="#3b82f6"
        />
      </div>

      {/* RWA Diversification */}
      {data.rwaAllocations?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">
              Treasury Diversification (RWA)
            </h3>
            <span className="text-xs text-gray-500">
              40% single-asset cap enforced on-chain
            </span>
          </div>

          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden mb-4">
            {data.rwaAllocations.map((alloc: RWAAllocation) => (
              <div
                key={alloc.type}
                style={{ width: `${alloc.pct}%`, background: alloc.color }}
                title={`${alloc.type}: ${alloc.pct}%`}
              />
            ))}
          </div>

          {/* Legend rows */}
          <div className="space-y-2">
            {data.rwaAllocations.map((alloc: RWAAllocation) => (
              <div
                key={alloc.type}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: alloc.color }}
                  />
                  <span className="text-xs text-gray-300">{alloc.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {alloc.value.toFixed(1)} ETH
                  </span>
                  <span className="text-xs text-gray-500">
                    ${alloc.valueUSD.toLocaleString()}
                  </span>
                  <span
                    className="text-xs font-bold w-8 text-right"
                    style={{ color: alloc.color }}
                  >
                    {alloc.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600 mt-3 border-t border-gray-800 pt-3">
            Real-world assets tokenized via ERC-4626 vaults · Rebalanced monthly
            by Treasury Agent
          </p>
        </div>
      )}

      {/* Area chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-4">
          6-Month Spending by Category (ETH)
        </h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                {categories.map((cat) => (
                  <linearGradient
                    key={cat}
                    id={`grad-${cat}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CATEGORY_COLORS[cat]}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={CATEGORY_COLORS[cat]}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }}
                iconType="circle"
                iconSize={8}
              />
              {categories.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="1"
                  stroke={CATEGORY_COLORS[cat]}
                  fill={`url(#grad-${cat})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spending breakdown bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-4">
          All-Time Spending Breakdown
        </h3>
        <div className="space-y-3">
          {breakdown.map(({ category, amount, pct }) => (
            <div key={category}>
              <div className="flex justify-between items-center mb-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: CATEGORY_COLORS[category] }}
                >
                  {category}
                </span>
                <span className="text-xs text-gray-400">
                  {amount.toFixed(3)} ETH ({pct}%)
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: CATEGORY_COLORS[category],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
