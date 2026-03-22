# DPI Guardians — Economic Model

## Overview

The DPI Guardians treasury operates as a public goods funding mechanism where the primary beneficiaries of libp2p infrastructure (protocol teams, dApp developers, node operators) can directly fund its maintenance. The model is designed to be sustainable at modest funding levels while scaling gracefully if adoption by major protocol foundations occurs.

---

## Revenue Streams

| Stream | Mechanism | Monthly Projection (Base) | Notes |
|---|---|---|---|
| **Direct Tips** | Users send ETH via TippingWidget; tiers from 0.01 to 1.0 ETH | 0.30 ETH | Assumes 30 coffee-tier, 3 sprint-tier, 0.5 champion-tier donors |
| **Bribe Escrows** | Protocol stakeholders lock ETH to prioritize features; 100% of escrow funds flow to the DPI Treasury on delivery | 0.25 ETH | Assumes 3–4 escrows/month at avg 0.25 ETH; full amount retained by treasury |
| **Crypto Yield** | Idle ETH deployed to liquid staking (stETH/rETH); current APY ~4.5% | 0.11 ETH | On 2.5 ETH average balance; compounds monthly |
| **RWA Yield** | 20% of reserves allocated to tokenized T-bills (Ondo OUSG) and tokenized real estate; APY ~6–8% | 0.05 ETH | Diversification buffer; uncorrelated with crypto market |
| **Streaming Agreements** | Protocol teams stream ETH/month to treasury under SLA; predictable recurring revenue | 0.10 ETH | Early-stage; expected to grow as swarm reputation builds |
| **Total** | | **0.81 ETH/month** | At ETH ~$2,500* this is ~$2,025/month (\*verify at time of presentation) |

---

## Cost Structure

| Category | Description | Monthly Cost (Base) |
|---|---|---|
| **LLM Inference** | Claude Sonnet API calls for PR review, issue triage, documentation; ~15,000 calls/month | 0.12 ETH |
| **Infrastructure** | RPC nodes (Alchemy), IPFS pinning (Web3.Storage), monitoring (Grafana Cloud) | 0.08 ETH |
| **On-Chain Gas** | EAS attestations, treasury interactions, score updates (~200 txs/month on L2) | 0.02 ETH |
| **Security Retainer** | Monthly time from external security firm for advisory review | 0.04 ETH |
| **Contributor Stipends** | Performance bonuses to top 3 contributors; discretionary | 0.00 ETH |
| **Total** | | **0.26 ETH/month** |

**Net (Base Case): +0.55 ETH/month** — positive cashflow that accrues to treasury reserves. Note: switching from GPT-4o to Claude Sonnet reduces inference costs by ~57%.

---

## Scenario Analysis

| Scenario | Conditions | Monthly Revenue | Monthly Costs | Net | Runway Impact |
|---|---|---|---|---|---|
| **Bear** | Crypto market down; only 10 tippers; no escrows; RWA yields compressed | 0.25 ETH | 0.30 ETH | -0.05 ETH | Treasury depletes in ~50 months — highly resilient due to RWA diversification |
| **Base** | Moderate community engagement; 3 escrows/month; 1 streaming agreement | 0.81 ETH | 0.26 ETH | +0.55 ETH | Treasury grows ~6.6 ETH/year |
| **Bull** | Foundation streaming agreements active; active escrow market; RWA yields 8% | 2.50 ETH | 0.32 ETH | +2.18 ETH | 100 ETH endowment reachable in ~18 months |

*All ETH figures at ~$2,500/ETH. Verify current price at time of presentation.*

The bear case is now significantly more resilient than a crypto-only treasury: RWA positions (tokenized T-bills, real estate) are uncorrelated with ETH price and continue generating yield in a down market. Key levers:
- RWA allocation buffers revenue when crypto tip volume drops
- Claude Sonnet inference is already optimized vs legacy GPT-4o costs
- Reduce attestation frequency on low-value actions (saves ~30% on gas)

---

## Incentive Design

### The Prestige > Money Principle

Open-source contributor research consistently shows that extrinsic rewards (money) are less effective than intrinsic motivators (recognition, autonomy, mastery) for sustaining long-term contributions. DPI Guardians is designed accordingly:

- **The leaderboard is the primary reward**. Top contributors get persistent, on-chain proof of their work — an EAS attestation that cannot be deleted or disputed.
- **Badges are non-transferable**. "Core Maintainer" and "Security Reviewer" badges are soulbound to contributor addresses; they cannot be bought or sold.
- **Monetary rewards are secondary and discretionary**. Bounties on the Task Board are bonuses, not salaries. Contributors work for the software and the recognition, not for the ETH.
- **The swarm amplifies human effort**. By handling routine triage and review work, the swarm gives human contributors more time for the high-value, intellectually satisfying work — protocol design, hard bugs, architecture decisions.

### Bribe Escrow Design Choices

The term "bribe" is intentional and honest. The BribeEscrow contract makes the economic reality of open-source explicit: stakeholders with urgent feature needs *do* preferentially fund work that benefits them. The DPI Guardians system makes this transparent and fair by:

1. Publishing all escrows publicly on-chain — no backroom deals
2. Requiring delivery verification before fund release — no pay-without-delivery
3. **All escrow funds flow to the DPI Treasury on delivery** — the community collectively benefits, not individual contributors
4. Contributors are assigned by the agent based on reputation and capability — merit-based, not first-come-first-served

**Important:** Contributors who deliver escrowed features are rewarded with on-chain reputation, soulbound badges, and leaderboard recognition — not direct payment from the escrow. This reinforces the prestige > money principle and ensures the treasury remains the financial beneficiary of all platform activity. The feature deliverer gains something money cannot buy: a permanent, verifiable record of meaningful contribution to critical internet infrastructure.

---

## Anti-Gaming Safeguards

**Sybil Resistance on Contributor Scoring**: Accounts must be at least 6 months old on GitHub to appear on the leaderboard. Score updates require an EAS attestation signed by an agent token, preventing self-submission. Bulk contributions (e.g., opening 100 trivial issues) are detected and penalized by the PR Reviewer agent's scoring algorithm.

**Treasury Spending Caps**: Per-agent monthly budgets are enforced at the contract level. Even if an agent's signing key is compromised, an attacker can steal at most one month's operational budget before the cap triggers.

**Escrow Timeouts**: All escrows have mandatory deadlines. A feature that takes longer than expected can be re-escrowed by the depositor, but the original escrow refunds automatically — preventing funds from being locked indefinitely.

**Rate Limiting on Tips**: The TippingWidget enforces a soft limit of 5 tips per wallet per day to prevent wash-trading to inflate contributor scores (tips do not directly affect scores, but this prevents any future attack surface).

---

## Path to Sustainability

### Milestone 1 — Community Validation (Months 1–3)
- Target: 50 regular tippers, break-even on monthly costs
- Actions: Ship hackathon demo, write up in Ethereum ecosystem blog, present at ETHDenver
- Success metric: Treasury balance above 2.0 ETH after 3 months

### Milestone 2 — Foundation Partnerships (Months 4–8)
- Target: One foundation (Protocol Labs or Ethereum Foundation) sets up a Superfluid stream of 0.5 ETH/month
- Actions: Demonstrate 3-month track record of agent actions; present audit trail to foundation teams
- Success metric: Monthly net positive by 0.5 ETH; 6-month runway at all times

### Milestone 3 — Ecosystem Expansion (Months 9–18)
- Target: Expand swarm to cover rust-libp2p and nim-libp2p; add 2 new agent types
- Actions: Open-source the agent framework; partner with other DPI projects (Geth, IPFS)
- Success metric: Swarm handles 40% of routine maintenance without human intervention

### Milestone 4 — Protocol Endowment (Month 18+)
- Target: Establish a protocol-level endowment of 100 ETH generating yield sufficient to cover all operating costs indefinitely
- Actions: Submit governance proposal to relevant DAOs; demonstrate multi-year positive-sum track record
- Success metric: Swarm is self-sustaining without active fundraising

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM inference costs spike significantly | Medium | High | Design for model-agnosticism; benchmark cheaper models quarterly; maintain 3-month cost reserve |
| GitHub API rate limiting blocks agents | Low | High | Implement exponential backoff; distribute requests across multiple App credentials; cache aggressively |
| Smart contract exploit drains treasury | Low | Critical | Immutable contracts (no proxies); monthly budget caps; Guardian Council 3-of-5 override; bug bounty program |
| Key maintainers lose interest; leaderboard goes stale | Medium | Medium | Automate score updates; make leaderboard data accessible via public API for third-party integrations |
| Regulation targets autonomous on-chain agents | Low | High | Entity structure consultation; maintain human-in-the-loop for all financial decisions above 0.5 ETH |
| LLM produces incorrect code review, bad PR merged | Medium | Medium | Progressive autonomy framework limits merge rights; audit trail enables post-hoc accountability; human override window |
| Community perceives AI agents as threatening to contributor livelihoods | Medium | Medium | Frame clearly as force-multiplier, not replacement; leaderboard celebrates humans; agents handle chores, not creativity |
| Crypto market downturn reduces tip volume | High | Medium | RWA diversification (tokenized bonds, real estate) provides uncorrelated yield; bear scenario shows only -0.05 ETH/month even in severe downturn |
| RWA protocol counterparty risk (e.g. Ondo, RealT default) | Low | Medium | Diversify across multiple RWA protocols; cap any single RWA position at 40% of treasury (enforced at contract level) |
