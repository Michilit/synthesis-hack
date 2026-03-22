import React, { useState } from 'react'

interface Props {
  onTip: (amount: string, tier: string, message: string, anonymous: boolean) => void
}

interface TierConfig {
  id: string
  icon: string
  label: string
  amount: string
  description: string
  color: string
  borderColor: string
}

const TIERS: TierConfig[] = [
  {
    id: 'COFFEE',
    icon: '☕',
    label: 'Coffee',
    amount: '0.01',
    description: 'Funds 1 hour of CI costs',
    color: 'text-yellow-300',
    borderColor: 'border-yellow-700'
  },
  {
    id: 'SPRINT',
    icon: '🏃',
    label: 'Sprint',
    amount: '0.1',
    description: 'Funds 1 week of infrastructure',
    color: 'text-blue-300',
    borderColor: 'border-blue-700'
  },
  {
    id: 'CHAMPION',
    icon: '🏆',
    label: 'Champion',
    amount: '1.0',
    description: 'Funds 1 month of full operations',
    color: 'text-purple-300',
    borderColor: 'border-purple-700'
  },
  {
    id: 'CUSTOM',
    icon: '💎',
    label: 'Custom',
    amount: '',
    description: 'Name your price',
    color: 'text-green-300',
    borderColor: 'border-green-700'
  }
]

const CONFETTI = ['🎉', '✨', '🌟', '💜', '🛡️', '🚀', '⚡', '🎊']

export default function TippingWidget({ onTip }: Props) {
  const [selectedTier, setSelectedTier] = useState<string>('COFFEE')
  const [customAmount, setCustomAmount] = useState('')
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [tipped, setTipped] = useState(false)

  const activeTier = TIERS.find(t => t.id === selectedTier)!
  const amount = selectedTier === 'CUSTOM' ? customAmount : activeTier.amount

  function handleSend() {
    if (!amount || parseFloat(amount) <= 0) return
    onTip(amount, selectedTier, message, anonymous)
    setTipped(true)
  }

  function handleReset() {
    setTipped(false)
    setMessage('')
    setCustomAmount('')
    setSelectedTier('COFFEE')
  }

  if (tipped) {
    return (
      <div className="bg-gray-900 border border-purple-800 rounded-xl p-6 flex flex-col items-center text-center gap-4">
        <div className="text-5xl animate-bounce">🛡️</div>
        <div className="flex flex-wrap justify-center gap-2 text-2xl">
          {CONFETTI.map((e, i) => (
            <span key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>{e}</span>
          ))}
        </div>
        <h3 className="text-lg font-bold text-white">Thank you!</h3>
        <p className="text-sm text-gray-300">
          Your {activeTier.label} tip ({amount} ETH) funds {activeTier.description.toLowerCase()}.
          The swarm keeps running because of supporters like you.
        </p>
        <p className="text-xs text-gray-500">
          {anonymous ? 'Anonymous tip recorded on-chain.' : `Your tip has been attributed on-chain.`}
        </p>
        <button
          onClick={handleReset}
          className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Send another tip
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💜</span>
        <div>
          <h3 className="font-bold text-white text-sm">Tip the Swarm</h3>
          <p className="text-xs text-gray-500">Fund autonomous libp2p maintenance</p>
        </div>
      </div>

      {/* Tier selection */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TIERS.map(tier => (
          <button
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`p-3 rounded-lg border text-left transition-all ${
              selectedTier === tier.id
                ? `${tier.borderColor} bg-gray-800`
                : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{tier.icon}</span>
              <span className={`text-xs font-bold ${selectedTier === tier.id ? tier.color : 'text-gray-400'}`}>
                {tier.label}
              </span>
            </div>
            {tier.id !== 'CUSTOM' ? (
              <p className={`text-lg font-bold ${selectedTier === tier.id ? 'text-white' : 'text-gray-500'}`}>
                {tier.amount} ETH
              </p>
            ) : (
              <p className={`text-xs ${selectedTier === tier.id ? 'text-gray-300' : 'text-gray-600'}`}>
                Any amount
              </p>
            )}
            <p className={`text-xs mt-0.5 ${selectedTier === tier.id ? 'text-gray-400' : 'text-gray-600'}`}>
              {tier.description}
            </p>
          </button>
        ))}
      </div>

      {/* Custom amount input */}
      {selectedTier === 'CUSTOM' && (
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1">Amount (ETH)</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            placeholder="0.05"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-600"
          />
        </div>
      )}

      {/* Message */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">Message (optional)</label>
        <textarea
          rows={2}
          placeholder="Keep up the great work!"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-600 resize-none"
        />
      </div>

      {/* Anonymous toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-300">Anonymous tip</p>
          <p className="text-xs text-gray-500">Hide your address from the leaderboard</p>
        </div>
        <button
          onClick={() => setAnonymous(!anonymous)}
          className={`relative w-11 h-6 rounded-full transition-colors ${anonymous ? 'bg-purple-600' : 'bg-gray-700'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${anonymous ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!amount || parseFloat(amount) <= 0}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Send {amount ? `${amount} ETH` : 'Tip'} {activeTier.icon}
      </button>

      <p className="text-center text-xs text-gray-600 mt-2">
        Funds held in ERC-4626 yield vault · All spending on-chain
      </p>
    </div>
  )
}
