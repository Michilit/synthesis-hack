import { ethers } from 'hardhat';
import * as fs from 'fs/promises';
import * as path from 'path';

const DEPLOYMENTS_DIR = path.join(process.cwd(), 'deployments');

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === 'unknown' ? 'localhost' : network.name;

  console.log(`\nDeploying DPI Guardians contracts to ${networkName}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // 1. Deploy Treasury
  console.log('Deploying Treasury...');
  const TreasuryFactory = await ethers.getContractFactory('Treasury');
  const treasury = await TreasuryFactory.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`  Treasury deployed at: ${treasuryAddress}`);

  // 2. Deploy TippingSystem
  console.log('Deploying TippingSystem...');
  const TippingFactory = await ethers.getContractFactory('TippingSystem');
  const tipping = await TippingFactory.deploy(treasuryAddress, deployer.address);
  await tipping.waitForDeployment();
  const tippingAddress = await tipping.getAddress();
  console.log(`  TippingSystem deployed at: ${tippingAddress}`);

  // 3. Deploy BribeEscrow
  console.log('Deploying BribeEscrow...');
  const minimumBribe = ethers.parseEther('0.01');
  const BribeFactory = await ethers.getContractFactory('BribeEscrow');
  const bribeEscrow = await BribeFactory.deploy(deployer.address, minimumBribe, deployer.address);
  await bribeEscrow.waitForDeployment();
  const bribeEscrowAddress = await bribeEscrow.getAddress();
  console.log(`  BribeEscrow deployed at: ${bribeEscrowAddress}`);

  // 4. Deploy StreamingAgreement
  console.log('Deploying StreamingAgreement...');
  const StreamingFactory = await ethers.getContractFactory('StreamingAgreement');
  const streaming = await StreamingFactory.deploy(deployer.address);
  await streaming.waitForDeployment();
  const streamingAddress = await streaming.getAddress();
  console.log(`  StreamingAgreement deployed at: ${streamingAddress}`);

  // 5. Deploy ERC8004Registry
  console.log('Deploying ERC8004Registry...');
  const RegistryFactory = await ethers.getContractFactory('ERC8004Registry');
  const registry = await RegistryFactory.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`  ERC8004Registry deployed at: ${registryAddress}`);

  // Save deployment info
  const deployment = {
    network: networkName,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
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
