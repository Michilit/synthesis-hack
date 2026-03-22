import React, { useState, useEffect, useRef } from 'react'
import type { ActivityEvent } from '../types'

interface Props {
  events: ActivityEvent[]
  onNewEvent?: (event: ActivityEvent) => void
}

const SIMULATED_EVENTS: Omit<ActivityEvent, 'id' | 'timestamp'>[] = [
  {
    agentName: 'PR Reviewer',
    agentColor: '#a855f7',
    action: 'Reviewed pull request',
    details: 'go-libp2p#2860: chore: bump quic-go to v0.42.0',
  },
  {
    agentName: 'Issue Triager',
    agentColor: '#f59e0b',
    action: 'Labeled new issue',
    details: 'go-libp2p#3905: memory leak in ResourceManager under stream churn → triaged as priority:medium',
  },
  {
    agentName: 'Security Monitor',
    agentColor: '#3b82f6',
    action: 'Completed nightly scan',
    details: 'rust-libp2p dependency tree scanned — 0 new advisories, SBOM updated',
    txHash: '0xd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2'
  },
  {
    agentName: 'Release Manager',
    agentColor: '#22c55e',
    action: 'Version tag created',
    details: 'go-libp2p v0.38.2-rc1 tagged and pushed — CI triggered',
    txHash: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
  },
  {
    agentName: 'Docs Writer',
    agentColor: '#f97316',
    action: 'Documentation updated',
    details: 'Updated go-libp2p ConnectionManager docs to reflect v0.38.x allowlist behavior',
  },
  {
    agentName: 'PR Reviewer',
    agentColor: '#a855f7',
    action: 'Left review comment',
    details: 'go-libp2p#2862: suggested splitting large PR into smaller focused changes',
  },
  {
    agentName: 'Issue Triager',
    agentColor: '#f59e0b',
    action: 'Closed duplicate issue',
    details: 'go-libp2p#3906 is a duplicate of #3754 — linked and closed with explanation',
  },
]

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

let simIndex = 0

export default function ActivityFeed({ events: initialEvents, onNewEvent }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents)
  const [showAll, setShowAll] = useState(false)
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval>>()
  const simRef = useRef<ReturnType<typeof setInterval>>()

  // Re-render every 30s to update relative timestamps
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(tickRef.current)
  }, [])

  // Simulate new events every 15 seconds
  useEffect(() => {
    simRef.current = setInterval(() => {
      const template = SIMULATED_EVENTS[simIndex % SIMULATED_EVENTS.length]
      simIndex++
      const newEvent: ActivityEvent = {
        ...template,
        id: `sim-${Date.now()}`,
        timestamp: new Date().toISOString(),
      }
      setEvents(prev => [newEvent, ...prev])
      onNewEvent?.(newEvent)
    }, 15_000)
    return () => clearInterval(simRef.current)
  }, [onNewEvent])

  const displayed = showAll ? events : events.slice(0, 8)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="font-bold text-white text-sm">Live Activity Feed</h3>
        </div>
        <span className="text-xs text-gray-500">{events.length} events</span>
      </div>

      <div className="divide-y divide-gray-800/50">
        {displayed.map((event, idx) => (
          <div
            key={event.id}
            className={`px-4 py-3 hover:bg-gray-800/30 transition-colors ${idx === 0 ? 'bg-gray-800/20' : ''}`}
          >
            <div className="flex items-start gap-3">
              {/* Agent color indicator */}
              <div
                className="w-1 flex-shrink-0 rounded-full mt-1 self-stretch min-h-[40px]"
                style={{ background: event.agentColor }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {/* Agent badge */}
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: `${event.agentColor}22`,
                      color: event.agentColor,
                      border: `1px solid ${event.agentColor}44`
                    }}
                  >
                    {event.agentName}
                  </span>
                  {/* Action */}
                  <span className="text-xs text-gray-200">{event.action}</span>
                  {/* Time */}
                  <span className="text-xs text-gray-600 ml-auto flex-shrink-0">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>

                {/* Details */}
                <p className="text-xs text-gray-400 leading-relaxed">{event.details}</p>

                {/* Tx hash */}
                {event.txHash && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-xs text-gray-600">tx:</span>
                    <span className="text-xs font-mono text-purple-400 hover:text-purple-300 cursor-pointer">
                      {event.txHash.slice(0, 10)}…{event.txHash.slice(-8)}
                    </span>
                    <span className="text-xs text-gray-600">↗</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 8 && (
        <div className="px-4 py-3 border-t border-gray-800">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showAll ? '↑ Show less' : `↓ Load more (${events.length - 8} hidden)`}
          </button>
        </div>
      )}
    </div>
  )
}
