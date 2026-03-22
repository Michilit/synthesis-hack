import React from 'react'
import type { AgentStatus } from '../types'

interface Props {
  agents: AgentStatus[]
}

function StatusBadge({ status }: { status: AgentStatus['status'] }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        RUNNING
      </span>
    )
  }
  if (status === 'idle') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        IDLE
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        ERROR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
      PAUSED
    </span>
  )
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatNextRun(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now()
  if (diff <= 0) return 'soon'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `in ${minutes}m`
  return `in ${Math.floor(minutes / 60)}h`
}

export default function AgentStatusGrid({ agents }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {agents.map(agent => (
        <div
          key={agent.id}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4 relative overflow-hidden"
          style={{ borderLeft: `4px solid ${agent.color}` }}
        >
          {/* Running glow effect */}
          {agent.status === 'running' && (
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{ background: `radial-gradient(circle at top left, ${agent.color}, transparent 70%)` }}
            />
          )}

          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{agent.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">{agent.name}</h3>
                  {agent.status === 'running' && (
                    <svg
                      className="w-3.5 h-3.5 animate-spin text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono">ERC-8004 #{agent.tokenId}</p>
              </div>
            </div>
            <StatusBadge status={agent.status} />
          </div>

          {/* Last action */}
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last action</p>
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{agent.lastAction}</p>
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-gray-500">Actions today</p>
                <p className="text-sm font-bold" style={{ color: agent.color }}>{agent.actionsToday}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last run</p>
                <p className="text-xs text-gray-300">{formatRelativeTime(agent.lastRun)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Next run</p>
              <p className="text-xs text-gray-300">{formatNextRun(agent.nextRun)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
