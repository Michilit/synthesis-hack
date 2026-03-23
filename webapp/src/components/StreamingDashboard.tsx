import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StreamingAgreement {
  id: string;
  payer: string;
  payerName: string;
  token: string;
  ratePerSecond: number;
  totalStreamed: number;
  totalClaimed: number;
  stillFlowing: number;
  startDate: string;
  slaMaxDowntimeHours: number;
  slaMaxResponseHours: number;
  status: 'active' | 'paused' | 'cancelled';
  runwayContributionMonths: number;
}

const mockAgreements: StreamingAgreement[] = [
  {
    id: '1',
    payer: '0xEF123...abc',
    payerName: 'Ethereum Foundation',
    token: 'ETH',
    ratePerSecond: 0.0000003858,
    totalStreamed: 1.24,
    totalClaimed: 1.10,
    stillFlowing: 0.14,
    startDate: '2025-09-01',
    slaMaxDowntimeHours: 24,
    slaMaxResponseHours: 72,
    status: 'active',
    runwayContributionMonths: 5.6,
  },
  {
    id: '2',
    payer: '0xPL456...def',
    payerName: 'Protocol Labs',
    token: 'USDC',
    ratePerSecond: 0.001157,
    totalStreamed: 3200,
    totalClaimed: 2900,
    stillFlowing: 300,
    startDate: '2025-11-15',
    slaMaxDowntimeHours: 48,
    slaMaxResponseHours: 96,
    status: 'active',
    runwayContributionMonths: 4.1,
  },
  {
    id: '3',
    payer: '0xFF789...ghi',
    payerName: 'Filecoin Foundation',
    token: 'ETH',
    ratePerSecond: 0.0000001929,
    totalStreamed: 0.42,
    totalClaimed: 0.38,
    stillFlowing: 0.04,
    startDate: '2026-01-10',
    slaMaxDowntimeHours: 24,
    slaMaxResponseHours: 48,
    status: 'active',
    runwayContributionMonths: 1.9,
  },
];

// Generate mock stream flow data for area chart (30 days)
const generateFlowData = () =>
  Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    streamed: parseFloat((i * 0.16).toFixed(3)),
    claimed: parseFloat((i * 0.14).toFixed(3)),
  }));

const SLABadge = ({ hours, label }: { hours: number; label: string }) => (
  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
    {label}: {hours}h
  </span>
);

const StatusDot = ({ status }: { status: StreamingAgreement['status'] }) => {
  const colors = { active: 'bg-emerald-400', paused: 'bg-yellow-400', cancelled: 'bg-rose-400' };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[status]} ${status === 'active' ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-400 capitalize">{status}</span>
    </span>
  );
};

export const StreamingDashboard: React.FC = () => {
  const flowData = generateFlowData();
  const totalStreamed = mockAgreements.reduce((s, a) => s + a.totalStreamed, 0);
  const totalClaimed = mockAgreements.reduce((s, a) => s + a.totalClaimed, 0);
  const totalFlowing = mockAgreements.reduce((s, a) => s + a.stillFlowing, 0);
  const totalRunway = mockAgreements.reduce((s, a) => s + a.runwayContributionMonths, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Streamed (All Time)', value: `${totalStreamed.toFixed(2)} ETH equiv.`, color: 'text-indigo-400' },
          { label: 'Currently Flowing', value: `${totalFlowing.toFixed(3)} ETH equiv.`, color: 'text-emerald-400' },
          { label: 'Total Claimed', value: `${totalClaimed.toFixed(2)} ETH equiv.`, color: 'text-blue-400' },
          { label: 'Runway Provided', value: `${totalRunway.toFixed(1)} months`, color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Flow Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Stream Flow — Last 30 Days</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={flowData}>
            <defs>
              <linearGradient id="streamGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="claimGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} interval={6} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={45} />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
            <Area type="monotone" dataKey="streamed" stroke="#6366f1" fill="url(#streamGrad)" name="Streamed" />
            <Area type="monotone" dataKey="claimed" stroke="#10b981" fill="url(#claimGrad)" name="Claimed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Active Agreements */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Active Streaming Agreements</h3>
        {mockAgreements.map(agreement => {
          const claimPct = (agreement.totalClaimed / agreement.totalStreamed) * 100;
          const monthlyRate = agreement.ratePerSecond * 60 * 60 * 24 * 30;
          return (
            <div key={agreement.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-100">{agreement.payerName}</div>
                  <div className="text-xs text-gray-500 font-mono">{agreement.payer}</div>
                </div>
                <div className="text-right">
                  <StatusDot status={agreement.status} />
                  <div className="text-xs text-gray-500 mt-1">since {agreement.startDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Rate</div>
                  <div className="text-gray-200 font-medium">{monthlyRate.toFixed(3)} {agreement.token}/mo</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Total Streamed</div>
                  <div className="text-indigo-400 font-medium">{agreement.totalStreamed.toFixed(2)} {agreement.token}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Runway Contribution</div>
                  <div className="text-emerald-400 font-medium">{agreement.runwayContributionMonths} months</div>
                </div>
              </div>

              {/* Progress bar: claimed vs streamed */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Claimed {claimPct.toFixed(0)}%</span>
                  <span>{agreement.stillFlowing.toFixed(3)} {agreement.token} available to claim</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(claimPct, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <SLABadge hours={agreement.slaMaxDowntimeHours} label="Max downtime" />
                <SLABadge hours={agreement.slaMaxResponseHours} label="Response SLA" />
                <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/50">
                  SLA: Compliant
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/50 rounded-xl p-6 text-center">
        <div className="text-lg font-semibold text-gray-100 mb-2">Sustain libp2p Infrastructure</div>
        <p className="text-gray-400 text-sm mb-4 max-w-lg mx-auto">
          If your protocol or project depends on libp2p, consider a streaming agreement. 
          Funds flow directly to the treasury, extending runway for agents and the Shipyard stewardship team.
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-4">
          {[
            { label: 'Basic SLA', rate: '0.001 ETH/mo', coverage: '24h downtime SLA' },
            { label: 'Standard SLA', rate: '0.005 ETH/mo', coverage: '12h downtime SLA' },
            { label: 'Premium SLA', rate: '0.02 ETH/mo', coverage: '4h response SLA' },
          ].map(tier => (
            <div key={tier.label} className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 text-left">
              <div className="text-xs font-semibold text-indigo-400">{tier.label}</div>
              <div className="text-sm font-bold text-gray-100 my-1">{tier.rate}</div>
              <div className="text-xs text-gray-500">{tier.coverage}</div>
            </div>
          ))}
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-6 py-2 rounded-lg transition-colors">
          Start Streaming Agreement
        </button>
      </div>
    </div>
  );
};
