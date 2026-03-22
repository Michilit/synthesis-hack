# DPI Guardians — Agent Specifications

## Overview

Five specialized agents form the DPI Guardians swarm. Each agent is a Node.js process that communicates with the GitHub API, an Ethereum RPC endpoint, and an LLM API. Agents share no state directly — coordination happens through on-chain attestations and the shared GuardianTreasury contract.

---

## Agent 1: PR Reviewer

**One-line purpose**: Autonomous technical review of pull requests across the libp2p ecosystem.

### Responsibilities
- Fetch and analyze PR diffs, descriptions, and linked issues
- Evaluate code quality, test coverage, security implications, and protocol compliance
- Post structured review comments on GitHub (approve / request changes / comment)
- Auto-assign reviewers based on CODEOWNERS and contributor expertise
- Track which PRs have been waiting for review > 48 hours and escalate
- Score contributors based on PR quality metrics
- Create an EAS attestation for every completed review

### Trigger Conditions
- **Primary**: GitHub webhook on `pull_request` events (opened, synchronized, review_requested)
- **Scheduled**: Hourly sweep to catch PRs not covered by webhooks
- **Escalation**: Immediate trigger if a PR targets `main` and has been unreviewed for 72 hours

### Tools Used
- GitHub API v4 (GraphQL) for fetching PR data, posting reviews, assigning reviewers
- `@octokit/rest` for webhook handling
- OpenAI GPT-4o (or Anthropic Claude 3.5 Sonnet) for code analysis
- `ethers.js` for EAS attestation submission
- CODEOWNERS parser for reviewer assignment

### LLM Prompt Overview
The agent uses a structured system prompt that includes:
1. The PR diff (truncated to 8,000 tokens for large PRs, with a summary for remainder)
2. The PR description and linked issue text
3. Recent test results from CI (pass/fail + coverage delta)
4. A list of the top 10 recent commits in the changed files (for context on author intent)
5. Relevant CODEOWNERS entries

The prompt instructs the LLM to output a JSON object with fields: `decision` (approve/request_changes/comment), `summary` (2–3 sentence review), `concerns` (array of specific issues), `suggestions` (array of improvement suggestions), `securityRisk` (low/medium/high), `confidenceScore` (0.0–1.0).

The runtime validates this JSON schema before acting. If confidence is below 0.7, the agent posts a comment asking a specific human reviewer to look at the PR rather than submitting a definitive review.

### Key Metrics Tracked
- PRs reviewed per day (target: 15+)
- Average review latency from PR open (target: < 4 hours)
- Human override rate (agent-approved PRs that were later reverted or re-reviewed)
- Contributor score deltas submitted per week
- False positive rate on security risk flags

### Failure Modes and Recovery
- **GitHub API timeout**: Retry with exponential backoff (3 attempts, 5s/10s/20s delays). If persistent, skip and re-queue after 1 hour.
- **LLM returns invalid JSON**: Retry once with a more restrictive prompt. If still invalid, post a generic "review queued" comment and flag for human review.
- **PR too large to analyze**: Post a comment noting the PR exceeds analysis limits and suggest breaking it into smaller PRs; escalate to human reviewer.
- **Signing key unavailable**: Log error, continue with GitHub-only actions (no attestations), alert Guardian Council.

---

## Agent 2: Issue Triager

**One-line purpose**: Triage, prioritize, and route all incoming GitHub issues across the libp2p ecosystem.

### Responsibilities
- Classify new issues by type (bug, feature, question, documentation)
- Assign priority labels (priority:critical, priority:high, priority:medium, priority:low)
- Tag issues with area labels (area:yamux, area:quic, area:security, area:performance, etc.)
- Identify and link duplicate issues across repositories
- Close stale issues (no activity > 90 days) with an explanatory comment
- Surface high-priority bugs in the weekly maintainer digest
- Create GitHub sub-issues and link to upstream/downstream repos when appropriate
- Publish priority-weighted task list to ContributorRegistry for bounty assignment

### Trigger Conditions
- **Primary**: GitHub webhook on `issues` events (opened, labeled, commented, closed)
- **Scheduled**: Every 5 minutes for newly opened issues; daily sweep for stale detection
- **Escalation**: Immediate trigger on issues labeled `security` or `panic` in title

### Tools Used
- GitHub API v4 (GraphQL) for label management, issue linking, closing
- OpenAI GPT-4o for classification and duplicate detection
- Semantic search via embeddings (text-embedding-3-small) stored in a local FAISS index
- `ethers.js` for EAS attestation on triage decisions

### LLM Prompt Overview
The agent uses a two-stage LLM pipeline:
1. **Classification stage**: Short prompt that takes the issue title + body and outputs structured JSON: `{ type, priority, areas[], isDuplicate, duplicateCandidates[], confidence }`. Uses a fine-tuned classification approach with few-shot examples from the repo's labeling history.
2. **Response stage**: If the issue is a question or documentation issue, generates a helpful first-response comment pointing to relevant docs or existing issues. Only fires if confidence > 0.85 to avoid off-topic responses.

Duplicate detection uses the embeddings index: if the semantic similarity to any open issue exceeds 0.92, the agent links the potential duplicate and sets `needs-dedup` label for human confirmation.

### Key Metrics Tracked
- New issues triaged per day (target: 100% within 30 minutes)
- Duplicate detection accuracy (validated by human maintainers monthly)
- Stale issues closed per week
- False positive rate on `priority:critical` labels (target: < 5%)
- Average time from issue open to first label applied

### Failure Modes and Recovery
- **Embeddings index out of sync**: Rebuild nightly. If rebuild fails, fall back to keyword-based duplicate detection.
- **Label permissions error**: Cache pending label operations, retry after 10 minutes. Alert if persistent after 3 attempts.
- **Miscategorized issue**: Human maintainer can override by editing labels — the agent detects this and records it as a correction event, feeding back into prompt calibration.
- **High volume spike (e.g., after a release)**: Batching mode activates when queue depth > 50; issues processed in priority order (security first, then by opening time).

---

## Agent 3: Release Manager

**One-line purpose**: Coordinate and execute the libp2p release process from milestone completion to published tags.

### Responsibilities
- Monitor GitHub milestones for completion (all issues closed, all PRs merged)
- Generate structured changelogs from merged PR titles and descriptions
- Draft release notes with sections for breaking changes, features, bug fixes, and performance improvements
- Create and push annotated git tags after human approval
- Notify downstream dependents (IPFS, Filecoin, Polkadot teams) via GitHub issues in their repos
- Update version references in documentation
- Trigger BribeEscrow release for completed features
- Publish release attestation on-chain with changelog IPFS CID

### Trigger Conditions
- **Primary**: GitHub webhook on `milestone` closed event
- **Scheduled**: Every 6 hours to check milestone progress and update estimates
- **Manual**: Guardian Council can trigger a release review via a specific GitHub comment format

### Tools Used
- GitHub API v4 for milestone/PR data, tag creation (after approval), cross-repo issue creation
- `conventional-commits` parser for structured changelog generation
- OpenAI GPT-4o for release notes prose and summary generation
- IPFS HTTP client for publishing changelog artifacts
- `ethers.js` for BribeEscrow interaction and release attestation

### LLM Prompt Overview
The release notes generation prompt provides:
- Complete list of merged PR titles, descriptions, and authors since last release
- List of closed issues with their types and priorities
- Previous release notes for style continuity
- Template structure (breaking changes, new features, bug fixes, dependencies)

The LLM outputs a Markdown release notes draft. The agent then formats this into the GitHub release body format, adds contributor @mentions, and presents it to the Release Manager human for approval via a GitHub PR.

Tag creation only proceeds after a human maintainer approves the release PR and comments `/approve-release`. This is a hard constraint — the agent has no capability to tag without explicit human sign-off.

### Key Metrics Tracked
- Time from milestone close to release tag (target: < 24 hours for patch, < 48 hours for minor)
- Changelog completeness (PRs with missing descriptions flagged before release)
- Downstream notification coverage (all registered dependents notified)
- BribeEscrow releases triggered correctly per release cycle

### Failure Modes and Recovery
- **Milestone incomplete at release attempt**: Agent notifies maintainers of remaining open items; does not proceed with release.
- **Tag already exists**: Fatal error — agent halts and alerts Guardian Council. Never force-push a tag.
- **IPFS publish fails**: Store changelog in GitHub release description as fallback; retry IPFS upload hourly for 24 hours.
- **BribeEscrow release reverts**: Alert Guardian Council; manually verify delivery criteria; may require human to call release function directly.

---

## Agent 4: Security Monitor

**One-line purpose**: Continuous security surveillance of the libp2p dependency ecosystem with on-chain transparency.

### Responsibilities
- Scan all dependency trees (go.mod, package.json, Cargo.toml) for known CVEs
- Monitor GitHub Advisory Database and OSV.dev for new advisories affecting libp2p dependencies
- Generate Software Bill of Materials (SBOM) in SPDX and CycloneDX formats after each scan
- Publish SBOMs to IPFS and record CIDs on-chain
- Create GitHub security advisories for critical findings
- Ping maintainers via GitHub issue for medium+ severity findings
- Draft quarterly security summaries for governance forum
- Audit agent action logs for anomalous spending or behavior patterns

### Trigger Conditions
- **Scheduled**: Full dependency scan daily at 02:00 UTC
- **Continuous**: Advisory feed monitoring every 15 minutes
- **On-demand**: Triggered by Release Manager before any release tag is created
- **Escalation**: Immediate response to any advisory with CVSS score >= 7.0

### Tools Used
- `osv-scanner` and `grype` for vulnerability scanning
- `syft` for SBOM generation
- OSV.dev REST API and GitHub Advisory Database GraphQL API for advisory monitoring
- IPFS HTTP client for SBOM publishing
- OpenAI GPT-4o for writing human-readable advisory summaries
- `ethers.js` for SBOM CID attestation and spending audit log queries

### LLM Prompt Overview
The agent uses LLM for two tasks:
1. **Advisory summarization**: Given raw CVE data (CVSS score, affected versions, patch details), generate a 3–5 sentence human-readable summary suitable for a maintainer notification GitHub issue.
2. **Impact assessment**: Given the advisory and the current repo's dependency usage, assess whether the vulnerability is actually reachable in practice, or whether usage patterns make it low-risk despite the CVSS score.

The impact assessment output includes: `exploitable` (yes/no/uncertain), `exploitPath` (description if yes), `recommendation` (update/mitigate/monitor), and `urgency` (immediate/next-release/informational).

### Key Metrics Tracked
- Time from advisory publication to internal notification (target: < 2 hours for critical)
- SBOM freshness (days since last successful scan; target: < 1 day)
- CVE false positive rate on impact assessments (validated by security retainer monthly)
- Quarterly audit summary publication cadence

### Failure Modes and Recovery
- **Scanner tool crash**: Retry 3 times with 5-minute backoff. If persistent, alert Guardian Council and skip that day's scan. Never mark a day as "clean" if scan did not complete.
- **IPFS publish unavailable**: Store SBOM in AWS S3 fallback bucket; retry IPFS upload hourly. Attestation records the S3 URL as fallback CID.
- **Advisory feed unavailable**: Cache last 7 days of advisory data locally. Alert if feed is unavailable for > 6 hours.
- **High-severity finding during business hours**: Immediately create GitHub issue, ping @libp2p/security-team, and send alert via configured Slack webhook.

---

## Agent 5: Docs Writer

**One-line purpose**: Keep libp2p documentation accurate, current, and accessible as the codebase evolves.

### Responsibilities
- Monitor merged PRs for API changes, new features, and deprecated functionality
- Update reference documentation (godoc, rustdoc, TypeDoc) with accurate descriptions
- Write tutorials and getting-started guides for significant new features
- Identify and fix documentation drift (docs that describe old behavior)
- Improve documentation discoverability by adding cross-references and examples
- Respond to issues tagged `documentation` by submitting a draft PR
- Monitor docs.libp2p.io user analytics for high-bounce pages indicating confusing content
- Translate technical concepts for ecosystem newcomers

### Trigger Conditions
- **Primary**: GitHub webhook on `pull_request` merged events in monitored repositories
- **Scheduled**: Daily audit of `documentation` tagged open issues; weekly docs drift scan
- **On-demand**: Triggered by Release Manager to update docs before release

### Tools Used
- GitHub API v4 for PR data and submitting documentation PRs
- OpenAI GPT-4o for documentation drafting and improvement
- `godoc`, `rustdoc`, TypeDoc CLI for rendering and validating docs locally
- Plausible Analytics API for docs.libp2p.io traffic data
- `ethers.js` for documentation PR attestation

### LLM Prompt Overview
The documentation generation prompt provides:
1. The merged PR diff (code changes only, not test files)
2. The PR description and any linked issues describing the feature
3. The current state of any affected documentation files
4. Style guide excerpts (libp2p docs use a specific tone and formatting convention)
5. Examples of well-written documentation from the same file

The LLM is instructed to output a complete Markdown file update, not a diff — the agent then uses `diff` to compute the change and creates a PR with only the changed sections. This avoids hallucinated reformatting of unrelated content.

Documentation PRs are always opened as drafts and require a human maintainer to mark them ready-for-review before merging. The agent never self-merges documentation.

### Key Metrics Tracked
- Documentation coverage (% of public API symbols with documentation; target: > 90%)
- Time from merged feature PR to documentation PR opening (target: < 48 hours)
- Documentation PR acceptance rate (merged vs. closed without merging; target: > 70%)
- High-bounce rate pages addressed per month
- Documentation issues resolved per week

### Failure Modes and Recovery
- **LLM generates inaccurate documentation**: Human review catches this before merge (docs PRs are always drafts). Incorrect docs that slip through are tracked and reduce the agent's confidence threshold for that file type.
- **PR creates merge conflict**: Agent attempts auto-rebase once. If conflict persists, closes the draft PR and leaves a comment on the original issue with the documentation draft for human application.
- **Docs infrastructure unavailable**: Agent stores pending documentation updates locally and retries when service is available. Guardian Council alerted if backlog exceeds 10 pending updates.
- **Rapidly changing codebase during release crunch**: Agent queues documentation updates and batches them into a single cleanup PR after the release tag is created, rather than creating many small PRs that conflict with release work.
