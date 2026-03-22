import 'dotenv/config';
import { AgentIdentityManager } from '../identity/AgentIdentity';

const identityManager = new AgentIdentityManager(true);

interface AgentDef {
  name: string;
  capabilities: string[];
  serviceEndpoints: string[];
  paymentAddress: string;
  metadataURI: string;
}

const AGENTS: AgentDef[] = [
  {
    name: 'MaintainerAgent',
    capabilities: ['pr-review', 'dependency-management', 'interop-testing', 'task-curation'],
    serviceEndpoints: ['https://dpi-guardians.io/agents/maintainer'],
    paymentAddress: '0x1111111111111111111111111111111111111111',
    metadataURI: 'ipfs://QmMaintainerAgentMetadataV1',
  },
  {
    name: 'TreasuryAgent',
    capabilities: ['fund-management', 'yield-optimization', 'pnl-reporting', 'escrow-management'],
    serviceEndpoints: ['https://dpi-guardians.io/agents/treasury'],
    paymentAddress: '0x2222222222222222222222222222222222222222',
    metadataURI: 'ipfs://QmTreasuryAgentMetadataV1',
  },
  {
    name: 'CommunityAgent',
    capabilities: ['newsletter-generation', 'project-discovery', 'contributor-board', 'referral-tracking'],
    serviceEndpoints: ['https://dpi-guardians.io/agents/community'],
    paymentAddress: '0x3333333333333333333333333333333333333333',
    metadataURI: 'ipfs://QmCommunityAgentMetadataV1',
  },
  {
    name: 'SupportAgent',
    capabilities: ['developer-support', 'dx-improvement', 'documentation'],
    serviceEndpoints: ['https://dpi-guardians.io/agents/support'],
    paymentAddress: '0x4444444444444444444444444444444444444444',
    metadataURI: 'ipfs://QmSupportAgentMetadataV1',
  },
  {
    name: 'ReviewAgent',
    capabilities: ['pr-quality-scoring', 'ai-slop-detection', 'badge-issuance', 'reputation-management'],
    serviceEndpoints: ['https://dpi-guardians.io/agents/review'],
    paymentAddress: '0x5555555555555555555555555555555555555555',
    metadataURI: 'ipfs://QmReviewAgentMetadataV1',
  },
];

async function main(): Promise<void> {
  console.log('\nDPI Guardians — Agent Registration\n');
  console.log('Registering 5 agents with AgentIdentityManager (local demo mode)...\n');

  const results: { name: string; tokenId: number; address: string }[] = [];

  for (const agent of AGENTS) {
    try {
      const tokenId = await identityManager.registerAgent(agent);
      results.push({
        name: agent.name,
        tokenId,
        address: agent.paymentAddress,
      });
    } catch (err) {
      console.error(`Failed to register ${agent.name}:`, err);
    }
  }

  // Print results table
  console.log('\n┌──────────────────────┬─────────┬────────────────────────────────────────────┐');
  console.log('│ Agent Name           │ TokenID │ Payment Address                            │');
  console.log('├──────────────────────┼─────────┼────────────────────────────────────────────┤');
  for (const r of results) {
    const name = r.name.padEnd(20);
    const id = r.tokenId.toString().padEnd(7);
    const addr = r.address.padEnd(42);
    console.log(`│ ${name} │ ${id} │ ${addr} │`);
  }
  console.log('└──────────────────────┴─────────┴────────────────────────────────────────────┘');

  console.log(`\nRegistered ${results.length}/${AGENTS.length} agents successfully.`);

  // Verify all agents
  console.log('\nVerifying registrations...');
  for (const r of results) {
    const verified = await identityManager.verifyAgent(r.tokenId);
    const identity = await identityManager.resolveAgent(r.tokenId);
    console.log(`  [${verified ? 'OK' : 'FAIL'}] ${r.name} (tokenId=${r.tokenId}) — ${identity?.capabilities.join(', ')}`);
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
