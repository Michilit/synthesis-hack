import React from 'react'
import type { Contributor } from '../types'

interface Props {
  contributors: Contributor[]
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Core Maintainer':   { bg: 'bg-purple-900/60', text: 'text-purple-300' },
  'Security Reviewer': { bg: 'bg-red-900/60',    text: 'text-red-300'    },
  'Release Lead':      { bg: 'bg-green-900/60',  text: 'text-green-300'  },
  'Protocol Designer': { bg: 'bg-blue-900/60',   text: 'text-blue-300'   },
  'Docs Champion':     { bg: 'bg-yellow-900/60', text: 'text-yellow-300' },
  'Bug Hunter':        { bg: 'bg-orange-900/60', text: 'text-orange-300' },
  '100 PRs':           { bg: 'bg-pink-900/60',   text: 'text-pink-300'   },
  '50 PRs':            { bg: 'bg-indigo-900/60', text: 'text-indigo-300' },
  '25 PRs':            { bg: 'bg-cyan-900/60',   text: 'text-cyan-300'   },
  'First PR':          { bg: 'bg-gray-700/60',   text: 'text-gray-300'   },
}

function rankDisplay(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return <span className="text-gray-500 font-mono text-sm">#{rank}</span>
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round((score / 1000) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-white font-bold text-sm w-10">{score}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden" style={{ minWidth: 60 }}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function ContributorBoard({ contributors }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-bold text-white">Contributor Leaderboard</h3>
        <span className="text-xs text-gray-500">{contributors.length} contributors this epoch</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase tracking-wide w-12">Rank</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">Contributor</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">Score</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">Badges</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">Commits</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map(c => {
              const isTop3 = c.rank <= 3
              return (
                <tr
                  key={c.githubHandle}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/30 ${isTop3 ? 'bg-purple-950/20' : ''}`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 text-center text-lg">
                    {rankDisplay(c.rank)}
                  </td>

                  {/* GitHub handle + address */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: `hsl(${(c.rank * 47) % 360}, 60%, 35%)` }}
                      >
                        {c.githubHandle[0].toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-medium ${isTop3 ? 'text-white' : 'text-gray-200'}`}>
                          @{c.githubHandle}
                        </p>
                        <p className="text-xs text-gray-600 font-mono">
                          {c.address.slice(0, 6)}…{c.address.slice(-4)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    <ScoreBar score={c.score} />
                  </td>

                  {/* Badges */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.badges.map(badge => {
                        const style = BADGE_COLORS[badge] ?? { bg: 'bg-gray-700', text: 'text-gray-300' }
                        return (
                          <span
                            key={badge}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border border-transparent ${style.bg} ${style.text}`}
                          >
                            {badge}
                          </span>
                        )
                      })}
                    </div>
                  </td>

                  {/* Contributions */}
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${isTop3 ? 'text-purple-300' : 'text-gray-300'}`}>
                      {c.contributions}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
        Scores computed by PR Review Agent · Updated every 6 hours · On-chain attestations via EAS
      </div>
    </div>
  )
}
