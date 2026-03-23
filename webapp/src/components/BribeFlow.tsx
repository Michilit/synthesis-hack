import React, { useState } from 'react';

type EscrowStatus = 'Deposited' | 'Broadcast' | 'Assigned' | 'Delivered' | 'Reviewed' | 'Released' | 'Disputed';

interface BribeEscrow {
  id: string;
  depositor: string;
  depositorName: string;
  amount: number;
  token: string;
  description: string;
  status: EscrowStatus;
  assignedContributor?: string;
  assignedContributorName?: string;
  yieldAccrued: number;
  createdAt: string;
  deadline?: string;
  deliveredAt?: string;
  isDisputed?: boolean;
}

const mockEscrows: BribeEscrow[] = [
  {
    id: '1',
    depositor: '0xCorp123...abc',
    depositorName: 'Waku Protocol',
    amount: 2.5,
    token: 'ETH',
    description: 'Implement WebRTC Direct transport for js-libp2p with full test coverage and spec compliance',
    status: 'Assigned',
    assignedContributor: '0xabc...001',
    assignedContributorName: 'voidwalker.eth',
    yieldAccrued: 0.031,
    createdAt: '2026-02-01',
    deadline: '2026-04-01',
  },
  {
    id: '2',
    depositor: '0xOrg456...def',
    depositorName: 'Celestia Labs',
    amount: 1.0,
    token: 'ETH',
    description: 'Fix QUIC handshake timeout issues under high packet loss (>5%) in go-libp2p',
    status: 'Delivered',
    assignedContributor: '0xabc...002',
    assignedContributorName: 'shipyard-alice',
    yieldAccrued: 0.009,
    createdAt: '2026-01-15',
    deadline: '2026-02-28',
    deliveredAt: '2026-02-20',
  },
  {
    id: '3',
    depositor: '0xDev789...ghi',
    depositorName: 'Polkadot Foundation',
    amount: 5.0,
    token: 'ETH',
    description: 'Implement Noise protocol handshake optimizations reducing connection setup time by 40%',
    status: 'Broadcast',
    yieldAccrued: 0.021,
    createdAt: '2026-03-01',
    deadline: '2026-06-01',
  },
];

const STATUS_STEPS: EscrowStatus[] = ['Deposited', 'Broadcast', 'Assigned', 'Delivered', 'Reviewed', 'Released'];

const StatusTracker = ({ status }: { status: EscrowStatus }) => {
  const current = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 mt-2">
      {STATUS_STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs
              ${i < current ? 'bg-emerald-500 border-emerald-500' : ''}
              ${i === current ? 'bg-indigo-500 border-indigo-500 ring-2 ring-indigo-400/30' : ''}
              ${i > current ? 'bg-gray-800 border-gray-700' : ''}
            `}>
              {i < current && <span className="text-white">✓</span>}
            </div>
            <span className={`text-xs mt-1 whitespace-nowrap
              ${i === current ? 'text-indigo-400 font-medium' : 'text-gray-600'}
            `}>{step}</span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mb-4 ${i < current ? 'bg-emerald-500' : 'bg-gray-800'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }: { status: EscrowStatus }) => {
  const styles: Record<EscrowStatus, string> = {
    Deposited: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
    Broadcast: 'bg-purple-900/40 text-purple-400 border-purple-800/50',
    Assigned: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
    Delivered: 'bg-indigo-900/40 text-indigo-400 border-indigo-800/50',
    Reviewed: 'bg-teal-900/40 text-teal-400 border-teal-800/50',
    Released: 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50',
    Disputed: 'bg-rose-900/40 text-rose-400 border-rose-800/50',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[status]}`}>{status}</span>
  );
};

export const BribeFlow: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: '', token: 'ETH', deadline: '60' });

  const totalLocked = mockEscrows.reduce((s, e) => s + e.amount, 0);
  const totalYield = mockEscrows.reduce((s, e) => s + e.yieldAccrued, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total in Escrow</div>
          <div className="text-xl font-bold text-indigo-400">{totalLocked.toFixed(1)} ETH</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Yield Accrued</div>
          <div className="text-xl font-bold text-emerald-400">{totalYield.toFixed(3)} ETH</div>
          <div className="text-xs text-gray-600 mt-0.5">goes to treasury on release</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Active Escrows</div>
          <div className="text-xl font-bold text-gray-100">{mockEscrows.filter(e => e.status !== 'Released').length}</div>
        </div>
      </div>

      {/* Treasury Routing Notice */}
      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex gap-3">
        <span className="text-blue-400 text-lg">ℹ</span>
        <div>
          <div className="text-sm font-medium text-blue-300">Funds route to the DPI Treasury — not contributors</div>
          <div className="text-xs text-blue-400/80 mt-1">
            Contributors earn reputation, badges, and prestige — the highest currency in open source.
            Financial sustainability belongs to the commons. This keeps incentives clean.
          </div>
        </div>
      </div>

      {/* Submit Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100">Submit Priority Feature Request</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Bribe'}
          </button>
        </div>

        {showForm && (
          <div className="space-y-4 border-t border-gray-800 pt-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Feature Description</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                rows={3}
                placeholder="Describe the feature you need. Be specific about acceptance criteria."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  placeholder="1.0"
                  min="1"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Token</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  value={formData.token}
                  onChange={e => setFormData({ ...formData, token: e.target.value })}
                >
                  {['ETH', 'USDC', 'DAI'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Deadline (days)</label>
                <input
                  type="number"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                  value={formData.deadline}
                  onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 text-xs text-yellow-400">
              Minimum bribe: 1 ETH. Set high to reflect opportunity cost. Funds held in yield-generating escrow.
              Your identity will be verified via SelfID before task assignment. Arbitration: 2-of-3 vote.
            </div>
            <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              Deposit Escrow
            </button>
          </div>
        )}
      </div>

      {/* Active Escrows */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300">Active & Recent Escrows</h3>
        {mockEscrows.map(escrow => (
          <div key={escrow.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-gray-100 text-sm">{escrow.description.slice(0, 80)}...</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  by {escrow.depositorName} · {escrow.createdAt}
                </div>
              </div>
              <StatusBadge status={escrow.status} />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              <div>
                <span className="text-gray-500">Amount: </span>
                <span className="text-indigo-400 font-medium">{escrow.amount} {escrow.token}</span>
              </div>
              <div>
                <span className="text-gray-500">Yield (→ treasury): </span>
                <span className="text-emerald-400">+{escrow.yieldAccrued.toFixed(3)} {escrow.token}</span>
              </div>
              {escrow.assignedContributorName && (
                <div>
                  <span className="text-gray-500">Assigned: </span>
                  <span className="text-gray-300">{escrow.assignedContributorName}</span>
                </div>
              )}
            </div>

            <StatusTracker status={escrow.status} />

            {escrow.status === 'Assigned' && escrow.deadline && (
              <div className="mt-3 text-xs text-yellow-400 bg-yellow-900/20 rounded px-3 py-1.5">
                Deadline: {escrow.deadline} · Human identity verified via SelfID
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
