import React, { useState, useEffect, useCallback } from 'react'
import AgentStatusGrid from './components/AgentStatus'
import TreasuryDashboard from './components/TreasuryDashboard'
import ContributorBoard from './components/ContributorBoard'
import TippingWidget from './components/TippingWidget'
import TaskBoard from './components/TaskBoard'
import ActivityFeed from './components/ActivityFeed'
import {
  mockAgents,
  mockTreasury,
  mockContributors,
  mockActivity,
  mockTasks,
  mockEscrows
} from './mockData'
import type { AgentStatus, TreasuryData, ActivityEvent } from './types'

type Tab = 'overview' | 'agents' | 'treasury' | 'contributors' | 'tasks' | 'activity'

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',     icon: '📊', label: 'Overview'     },
  { id: 'agents',       icon: '🤖', label: 'Agents'       },
  { id: 'treasury',     icon: '💰', label: 'Treasury'     },
  { id: 'contributors', icon: '👥', label: 'Contributors' },
  { id: 'tasks',        icon: '📋', label: 'Tasks'        },
  { id: 'activity',     icon: '⚡', label: 'Activity'     },
]

const AGENT_ACTIONS = [
  { agentIdx: 0, action: 'Reviewed pull request', details: 'go-libp2p#2863: fix: correct MTU detection for QUIC transport' },
  { agentIdx: 1, action: 'Triaged new issue',     details: 'go-libp2p#3907: connection timeout under heavy DHT load → priority:high' },
  { agentIdx: 2, action: 'Prepared release notes', details: 'go-libp2p v0.38.2 changelog finalized — 9 changes documented' },
  { agentIdx: 3, action: 'Security scan complete', details: 'js-libp2p@1.4.0 deps scanned — 0 vulnerabilities, SBOM updated on-chain' },
  { agentIdx: 4, action: 'Documentation updated',  details: 'Improved AutoNAT v2 API reference with practical examples' },
]

let actionIdx = 0

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [agents, setAgents] = useState<AgentStatus[]>(mockAgents)
  const [treasury, setTreasury] = useState<TreasuryData>(mockTreasury)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(mockActivity)

  // Simulate agent activity every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const { agentIdx: idx, action, details } = AGENT_ACTIONS[actionIdx % AGENT_ACTIONS.length]
      actionIdx++

      // Set agent to running
      setAgents(prev => prev.map((a, i) =>
        i === idx ? { ...a, status: 'running' as const } : a
      ))

      // After 3 seconds, set back to idle and record the action
      setTimeout(() => {
        setAgents(prev => prev.map((a, i) => {
          if (i !== idx) return a
          return {
            ...a,
            status: 'idle' as const,
            lastAction: details,
            lastRun: new Date().toISOString(),
            actionsToday: a.actionsToday + 1,
          }
        }))

        const agent = mockAgents[idx]
        const event: ActivityEvent = {
          id: `live-${Date.now()}`,
          timestamp: new Date().toISOString(),
          agentName: agent.name,
          agentColor: agent.color,
          action,
          details,
        }
        setActivityEvents(prev => [event, ...prev])
      }, 3000)
    }, 15_000)

    return () => clearInterval(interval)
  }, [])

  const handleTip = useCallback((amount: string, tier: string, message: string, anonymous: boolean) => {
    const eth = parseFloat(amount)
    setTreasury(prev => ({
      ...prev,
      balance: `${(parseFloat(prev.balance) + eth).toFixed(3)} ETH`,
      totalRaised: `${(parseFloat(prev.totalRaised) + eth).toFixed(3)} ETH`,
    }))

    const event: ActivityEvent = {
      id: `tip-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentName: 'Treasury',
      agentColor: '#f59e0b',
      action: `New ${tier} tip received`,
      details: anonymous
        ? `${amount} ETH anonymous tip received${message ? ` — "${message}"` : ''}`
        : `${amount} ETH tip received${message ? ` — "${message}"` : ''}`,
      txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`,
    }
    setActivityEvents(prev => [event, ...prev])
  }, [])

  const handleNewEvent = useCallback((event: ActivityEvent) => {
    setActivityEvents(prev => [event, ...prev])
  }, [])

  const runningCount = agents.filter(a => a.status === 'running').length
  const activeCount = agents.filter(a => a.status !== 'error' && a.status !== 'paused').length

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🛡️</span>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">DPI Guardians</h1>
              <p className="text-xs text-gray-500">Autonomous libp2p Maintenance</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                tab === item.id
                  ? 'bg-purple-900/50 text-purple-200 border border-purple-800/50'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold text-green-400">SWARM ACTIVE</span>
          </div>
          <p className="text-xs text-gray-500">{activeCount} agents online</p>
          {runningCount > 0 && (
            <p className="text-xs text-blue-400 mt-0.5">{runningCount} currently running</p>
          )}
          <div className="mt-3 px-2 py-1.5 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-500">Network</p>
            <p className="text-xs font-bold text-yellow-400">Sepolia Testnet</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white capitalize">
              {NAV_ITEMS.find(n => n.id === tab)?.label ?? 'Overview'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span className="text-xs text-yellow-400 font-medium">Sepolia Testnet</span>
            </div>
            <div className="px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
              <span className="text-xs text-gray-300">
                Progressive Autonomy:{' '}
                <span className="text-green-400 font-bold">847h saved this month</span>
                <span className="text-gray-500"> ↓ trending to 0</span>
              </span>
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Hero stats */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: 'Agents Active',    value: `${activeCount} / 5`,       icon: '🤖', color: '#a855f7' },
                  { label: 'PRs Reviewed',     value: '1,247',                    icon: '🔍', color: '#22c55e' },
                  { label: 'ETH Treasury',     value: treasury.balance,            icon: '💰', color: '#f59e0b' },
                  { label: 'Contributors',     value: mockContributors.length.toString(), icon: '👥', color: '#3b82f6' },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                    style={{ boxShadow: `0 0 20px ${stat.color}18` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</span>
                      <span className="text-xl">{stat.icon}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Agent Status</h3>
                  <AgentStatusGrid agents={agents} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Live Activity</h3>
                  <ActivityFeed events={activityEvents} onNewEvent={handleNewEvent} />
                </div>
              </div>
            </div>
          )}

          {/* AGENTS */}
          {tab === 'agents' && (
            <div className="space-y-6">
              <AgentStatusGrid agents={agents} />
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3">About ERC-8004 Agent Identities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400 leading-relaxed">
                  <p>
                    Each DPI Guardian agent holds a unique <span className="text-purple-300 font-medium">ERC-8004 Non-Fungible Agent Identity</span> token.
                    These tokens carry verifiable capability claims — what the agent is authorized to do — and are stored on Sepolia testnet.
                  </p>
                  <p>
                    Agent actions are logged as on-chain attestations via <span className="text-blue-300 font-medium">Ethereum Attestation Service (EAS)</span>.
                    This creates an immutable audit trail of every PR review, triage decision, and release operation performed by the swarm.
                  </p>
                  <p>
                    The <span className="text-green-300 font-medium">Progressive Autonomy Framework</span> gradually increases each agent's autonomy
                    as it accumulates a verified track record. New agents start at Level 1 (suggest-only) and can reach Level 5 (fully autonomous)
                    after 1,000 verified actions with 98%+ approval rate.
                  </p>
                  <p>
                    Human maintainers retain override capability at all times. A <span className="text-yellow-300 font-medium">Guardian Council multisig</span> (3-of-5)
                    can pause any agent, revoke capabilities, or modify reward parameters — ensuring humans stay in control as autonomy increases.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TREASURY */}
          {tab === 'treasury' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <TreasuryDashboard data={treasury} />
                </div>
                <div>
                  <TippingWidget onTip={handleTip} />
                </div>
              </div>

              {/* Active Escrows */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="font-bold text-white text-sm">Active Bribe Escrows</h3>
                  <p className="text-xs text-gray-500">Feature bounties locked until delivery</p>
                </div>
                <div className="divide-y divide-gray-800">
                  {mockEscrows.map(escrow => (
                    <div key={escrow.id} className="px-4 py-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-white">{escrow.feature}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Deadline: {escrow.deadline}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold text-yellow-400">{escrow.amount}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          escrow.state === 'IN_PROGRESS'
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-800'
                            : 'bg-green-900/50 text-green-300 border border-green-800'
                        }`}>
                          {escrow.state === 'IN_PROGRESS' ? '⚙️ In Progress' : '✅ Funded'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONTRIBUTORS */}
          {tab === 'contributors' && (
            <div className="space-y-6">
              <ContributorBoard contributors={mockContributors} />
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3">How Scores Are Calculated</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: '🔍', label: 'PR Quality',        desc: 'Code review thoroughness, test coverage, and discussion quality evaluated by AI agent' },
                    { icon: '⚡', label: 'Response Time',     desc: 'How quickly contributors engage with issues, review requests, and CI failures' },
                    { icon: '🏆', label: 'Impact Multiplier', desc: 'Commits to security-critical paths or protocol-level code receive bonus weight' },
                  ].map(item => (
                    <div key={item.label} className="flex gap-3">
                      <span className="text-2xl flex-shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TASKS */}
          {tab === 'tasks' && (
            <TaskBoard tasks={mockTasks} />
          )}

          {/* ACTIVITY */}
          {tab === 'activity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {agents.map(agent => (
                  <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                    <span className="text-xl">{agent.icon}</span>
                    <p className="text-xs font-medium text-gray-300 mt-1">{agent.name}</p>
                    <p className="text-lg font-bold mt-1" style={{ color: agent.color }}>
                      {activityEvents.filter(e => e.agentName === agent.name).length}
                    </p>
                    <p className="text-xs text-gray-600">events</p>
                  </div>
                ))}
              </div>
              <ActivityFeed events={activityEvents} onNewEvent={handleNewEvent} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
