import { ethers } from 'hardhat';
import * as fs from 'fs/promises';
import * as path from 'path';

if (!process.env.PRIVATE_KEY) {
  console.error('ERROR: PRIVATE_KEY not set. Set it in your environment before deploying.');
  process.exit(1);
}

// Mock token addresses for Sepolia (use real addresses for mainnet)
// These are well-known Sepolia test token addresses
const SEPOLIA_USDC  = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // Circle Sepolia USDC
const SEPOLIA_DAI   = '0x68194a729C2450ad26072b3D33ADaCbcef39D574'; // Sepolia DAI
const SEPOLIA_WETH  = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'; // Sepolia WETH

const DEPLOYMENTS_DIR = path.join(process.cwd(), 'deployments');

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === 'unknown' ? 'localhost' : network.name;

  // Use zero addresses for localhost (no real tokens needed in demo)
  const usdcAddr = networkName === 'localhost' ? ethers.ZeroAddress : SEPOLIA_USDC;
  const daiAddr  = networkName === 'localhost' ? ethers.ZeroAddress : SEPOLIA_DAI;
  const wethAddr = networkName === 'localhost' ? ethers.ZeroAddress : SEPOLIA_WETH;

  console.log(`\nDeploying DPI Guardians contracts to ${networkName}`);

  // 1. Deploy Treasury
  // constructor(address[] memory _boardMembers, uint256 _requiredSignatures)
  console.log('Deploying Treasury...');
  const TreasuryFactory = await ethers.getContractFactory('Treasury');
  const boardMembers = [deployer.address]; // single-member board for demo
  const treasury = await TreasuryFactory.deploy(boardMembers, 1);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`  Treasury:           ${treasuryAddress}`);

  // 2. Deploy TippingSystem
  // constructor(address _treasury, address _usdc, address _dai, address _weth)
  console.log('Deploying TippingSystem...');
  const TippingFactory = await ethers.getContractFactory('TippingSystem');
  const tipping = await TippingFactory.deploy(treasuryAddress, usdcAddr, daiAddr, wethAddr);
  await tipping.waitForDeployment();
  const tippingAddress = await tipping.getAddress();
  console.log(`  TippingSystem:      ${tippingAddress}`);

  // 3. Deploy BribeEscrow
  // constructor(address _treasury, uint256 _minimumBribe, address arb0, address arb1, address arb2)
  // Demo: use 0.01 ETH minimum bribe; deployer as all 3 arbitrators for demo
  console.log('Deploying BribeEscrow...');
  const minimumBribe = ethers.parseEther('0.01');
  const BribeFactory = await ethers.getContractFactory('BribeEscrow');
  const bribeEscrow = await BribeFactory.deploy(
    treasuryAddress,
    minimumBribe,
    deployer.address, // arb0
    deployer.address, // arb1
    deployer.address, // arb2
  );
  await bribeEscrow.waitForDeployment();
  const bribeEscrowAddress = await bribeEscrow.getAddress();
  console.log(`  BribeEscrow:        ${bribeEscrowAddress}`);

  // 4. Deploy StreamingAgreement
  // constructor(address _treasury)
  console.log('Deploying StreamingAgreement...');
  const StreamingFactory = await ethers.getContractFactory('StreamingAgreement');
  const streaming = await StreamingFactory.deploy(treasuryAddress);
  await streaming.waitForDeployment();
  const streamingAddress = await streaming.getAddress();
  console.log(`  StreamingAgreement: ${streamingAddress}`);

  // 5. Deploy ERC8004Registry
  // constructor() — no args
  console.log('Deploying ERC8004Registry...');
  const RegistryFactory = await ethers.getContractFactory('ERC8004Registry');
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`  ERC8004Registry:    ${registryAddress}`);

  // Save deployment info
  const deployment = {
    network: networkName,
    timestamp: new Date().toISOString(),
    contracts: {
      Treasury: treasuryAddress,
      TippingSystem: tippingAddress,
      BribeEscrow: bribeEscrowAddress,
      StreamingAgreement: streamingAddress,
      ERC8004Registry: registryAddress,
    },
  };

  await fs.mkdir(DEPLOYMENTS_DIR, { recursive: true });
  const deploymentPath = path.join(DEPLOYMENTS_DIR, `${networkName}.json`);
  await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${deploymentPath}`);

  // Print summary table
  console.log('\n┌────────────────────────┬────────────────────────────────────────────────┐');
  console.log('│ Contract               │ Address                                        │');
  console.log('├────────────────────────┼────────────────────────────────────────────────┤');
  const rows: [string, string][] = [
    ['Treasury', treasuryAddress],
    ['TippingSystem', tippingAddress],
    ['BribeEscrow', bribeEscrowAddress],
    ['StreamingAgreement', streamingAddress],
    ['ERC8004Registry', registryAddress],
  ];
  for (const [name, addr] of rows) {
    const paddedName = name.padEnd(22);
    const paddedAddr = addr.padEnd(46);
    console.log(`│ ${paddedName} │ ${paddedAddr} │`);
  }
  console.log('└────────────────────────┴────────────────────────────────────────────────┘');
  console.log('\nDeployment complete!\n');
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
