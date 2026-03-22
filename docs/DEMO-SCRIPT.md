# DPI Guardians — Demo Script

**The Synthesis Hackathon 2026**
Track: Agents that pay / trust / cooperate / keep secrets

---

## 1. Prerequisites

Ensure the following are installed before the demo:

- **Node.js 18+** (`node --version`)
- **Git** (`git --version`)
- **Hardhat** (installed via npm)
- Recommended: two terminal windows open side-by-side

```bash
node --version   # Expected: v18.x or v20.x
git --version    # Expected: git version 2.x
```

Clone and install:

```bash
git clone https://github.com/yourteam/dpi-guardians
cd dpi-guardians
npm install
cd webapp && npm install && cd ..
```

---

## 2. Deploy Contracts

Start a local Hardhat node in terminal 1:

```bash
npx hardhat node
```

Expected output:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

In terminal 2, deploy all contracts:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Expected output:
```
Deploying DPI Guardians contracts...
  GuardianNFT deployed to:     0x5FbDB2315678afecb367f032d93F642f64180aa3
  GuardianTreasury deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  BribeEscrow deployed to:     0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
  ContributorRegistry deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

Contracts deployed. Update .env with these addresses.
```

Copy the addresses into `.env` (a template `.env.example` is provided).

---

## 3. Register Agents

Run the agent registration script to mint ERC-8004 tokens for all 5 agents:

```bash
npx hardhat run scripts/register-agents.js --network localhost
```

Expected output:
```
Registering 5 Guardian Agents...
  [1/5] Minting token #1 for PR Reviewer...     ✓ tx: 0x4a2b...
  [2/5] Minting token #2 for Issue Triager...    ✓ tx: 0x7f3e...
  [3/5] Minting token #3 for Release Manager...  ✓ tx: 0x2c4e...
  [4/5] Minting token #4 for Security Monitor... ✓ tx: 0x8b1d...
  [5/5] Minting token #5 for Docs Writer...      ✓ tx: 0x3e5a...

All agents registered. Guardian Council: 0xf39F...2266
ERC-8004 capabilities set for all tokens.
```

Each agent now has an on-chain identity with verifiable capability claims.

---

## 4. Seed Demo Data

Populate the contracts with realistic demo state:

```bash
npm run seed
```

This script creates:
- **Treasury funding**: Sends 2.5 ETH to `GuardianTreasury`, deposits into ERC-4626 yield vault
- **Spending history**: Records 15 historical spending transactions across OPERATIONAL, AUDIT, and INFRASTRUCTURE categories
- **Contributor registry**: Registers 8 contributors with their GitHub handles and initial scores
- **Bribe escrows**: Creates 2 funded escrows (WebRTC connection pooling: 0.25 ETH, QUIC v2: 0.5 ETH)
- **Activity attestations**: Publishes 15 sample EAS attestations showing agent action history

Expected output:
```
Seeding demo data...
  Treasury funded: 2.5 ETH deposited
  Yield vault active: 5.2% APY
  8 contributors registered
  2 escrows created and funded
  15 EAS attestations published
Seed complete. Ready for demo.
```

---

## 5. Start the Swarm

Launch all 5 agents in swarm mode:

```bash
npm run swarm
```

What to expect in the terminal:
```
DPI Guardians Swarm v1.0.0
==========================
[PR Reviewer]       🔍  Watching go-libp2p, rust-libp2p, js-libp2p for new PRs...
[Issue Triager]     🗂️   Polling issue tracker every 5 minutes...
[Release Manager]   🚀  Monitoring milestones for completion...
[Security Monitor]  🔐  Running nightly dependency scan in 4h 12m...
[Docs Writer]       📝  Watching for merged PRs that need documentation...

Swarm active. 5/5 agents online.
Press Ctrl+C to gracefully shutdown all agents.

[14:32:11] Issue Triager  → Labeled go-libp2p#3901 as priority:high
[14:32:43] PR Reviewer    → Reviewing go-libp2p#2847 (12 files changed)
[14:33:01] PR Reviewer    → Approved go-libp2p#2847 — no security concerns
```

---

## 6. Open the Dashboard

In a third terminal, start the web dashboard:

```bash
cd webapp && npm run dev
```

Navigate to **http://localhost:3000** in your browser.

**What to show judges on first load:**

1. The dark sidebar with "SWARM ACTIVE" green pulsing indicator
2. The Overview tab with 4 hero stats — agents, PRs reviewed, treasury balance, contributors
3. The Live Activity Feed updating in real time as agents take actions
4. The agent status cards with color-coded left borders and live status badges
5. Point out the "Progressive Autonomy: 847h saved this month" header metric

---

## 7. Feature Walkthroughs

### 7a. Tipping Widget

Navigate to the **Treasury** tab.

1. Show the 4 stat cards: ETH Balance, Yield Balance, Total Raised, APY
2. Point out the 6-month area chart showing spending by category
3. On the right panel, click **Sprint** tier (0.1 ETH, "Funds 1 week of infrastructure")
4. Toggle the **Anonymous** switch on
5. Type a message: "Keep up the great work, swarm!"
6. Click **Send 0.1 ETH**
7. Show the success state with confetti
8. Switch to the **Activity** tab — the tip event appears at the top of the feed
9. Switch back to Treasury — balance has increased

**Talking point**: "Every tip is recorded on-chain. The treasury holds funds in an ERC-4626 yield vault, so even idle ETH earns 5.2% APY for the swarm."

### 7b. Bribe Escrow

Scroll down on the Treasury tab to the **Active Bribe Escrows** section.

1. Show the two funded escrows with amounts and deadlines
2. Explain: "Anyone can lock ETH here to prioritize a feature. The swarm agents see these escrows and weight their work accordingly. Funds only release when the PR is merged and verified."

**Talking point**: "This is credible commitment — a protocol-level guarantee that if you build it, you get paid. No trust required."

### 7c. PR Review Flow

Switch to the **Activity** tab.

1. Point to events from the PR Reviewer agent — show the colored agent badge
2. Show an event with a transaction hash — click to demonstrate it links to Etherscan
3. Explain the EAS attestation format: "Each action is a signed attestation. Maintainers can verify the agent's reasoning on-chain."
4. Switch to **Agents** tab and show the PR Reviewer card with `actionsToday` counter

**Talking point**: "This isn't just logging. Every agent action is a verifiable attestation. The audit trail is permanent and tamper-proof."

### 7d. Streaming Payments (Narrative)

On the **Treasury** tab, point to the yield balance:

"In production, this integrates with Superfluid for real-time streaming. Inference costs are deducted second-by-second as agents run. Contributors with active PRs under review receive a small stream as a time-value acknowledgment. The agents themselves hold a Superfluid stream for operational costs — if the treasury runs dry, the stream stops and agents pause gracefully."

### 7e. Contributor Board

Navigate to the **Contributors** tab.

1. Show the leaderboard with gold/silver/bronze medals for top 3
2. Point out the badge system — different colors for different achievement types
3. Show the score bars — normalized to 1000 points
4. Read the footer: "Scores computed by PR Review Agent · On-chain attestations via EAS"

**Talking point**: "The contributor board is a prestige layer, not a payment layer. Research shows open-source contributors are more motivated by recognition than money. The swarm surfaces and celebrates the humans doing the real work."

---

## 8. Key Talking Points for Judges

### On-Chain Identity (ERC-8004)
- Agents have verifiable identities, not just API keys. Their capabilities are encoded in the token and can be restricted or expanded by the Guardian Council multisig.
- Compare to: a contractor with a verified professional license vs. an anonymous freelancer.

### Economic Sustainability
- Three revenue streams: tips (demand-driven), bribe escrows (feature-prioritization), and yield on idle treasury funds.
- The model is designed to break even at ~0.4 ETH/month in tips — equivalent to 40 coffee-tier donors.
- Bull case: protocol foundations (Protocol Labs, Ethereum Foundation) fund the swarm as critical infrastructure maintenance.

### Progressive Autonomy
- The swarm starts conservative. New agents operate at Level 1 (suggestions only) and earn autonomy through a verified track record.
- This directly addresses the "AI alignment" concern: autonomy is earned, not assumed.
- The 847h/month metric measures real human time saved — a concrete demonstration of ROI.

### Trust Model
- "Don't trust, verify" — every agent action is an on-chain attestation.
- Human override is always one multisig transaction away.
- The system is designed to be useful even if the AI is wrong sometimes — human maintainers review high-stakes decisions.

### The Real Problem
- libp2p is foundational infrastructure for Ethereum, IPFS, Filecoin, Polkadot, and Celestia — yet it's maintained by a tiny team.
- The DPI Guardians address this with a scalable, funded, autonomous maintenance layer that grows with the ecosystem.

---

## 9. Q&A Preparation

**Q: What happens if an agent makes a wrong decision?**

A: "We've designed multiple safeguards. First, the Progressive Autonomy Framework means new agents can only suggest — they can't merge or publish without human approval. Second, every action is an on-chain attestation, so the audit trail is permanent. Third, the Guardian Council multisig can pause any agent instantly. The system is designed to be correctable, not infallible."

**Q: How do you prevent the treasury from being drained?**

A: "Three mechanisms: (1) Monthly spending caps enforced at the smart contract level — no single agent can exceed its monthly budget. (2) The 3-of-5 Guardian Council multisig must approve any spending above the cap. (3) Funds are held in an ERC-4626 yield vault, not a simple wallet — withdrawals go through the vault's access controls."

**Q: Isn't this just expensive for small projects? Who pays for the LLM inference?**

A: "Great question. At current inference costs, the swarm costs about 0.4 ETH/month to run, which is ~$1,200 at current ETH prices. For a protocol like libp2p that underpins billions of dollars of infrastructure, that's extremely cheap. And the tipping model means the community that benefits pays for maintenance — not just a single foundation."

**Q: How does the bribe escrow know a feature was actually implemented correctly?**

A: "Today, the Release Manager agent verifies the relevant PR was merged to main. In the next version, we're building a ZK proof system where the agent generates a proof that specific tests passed, which unlocks the escrow automatically. No human judgment needed in the release path."

**Q: What prevents a bad actor from gaming the contributor scoring system?**

A: "The scoring algorithm is run by the PR Reviewer agent, not self-reported. An agent reads all PR discussions, reviews the code diffs, and scores based on technical substance — not just quantity. We also have a time-decay function so old contributions don't dominate, and a Sybil-resistance layer that requires GitHub account age > 6 months for leaderboard eligibility."
