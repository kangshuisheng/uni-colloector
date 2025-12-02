#!/usr/bin/env bun
import { publicClient, CONTRACTS, account } from './config';
import { parseAbi } from 'viem';

console.log('🔍 Detecting Your LP Position from Wallet\n');

// PositionManager ABI for querying positions
const POSITION_MANAGER_ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function positions(uint256 tokenId) external view returns (bytes32 poolId, int24 tickLower, int24 tickUpper)',
]);

const walletAddress = account.address;
console.log(`Wallet: ${walletAddress}\n`);

try {
  // 1. Check how many positions the wallet has
  const balance = await publicClient.readContract({
    address: CONTRACTS.positionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  });

  console.log(`✅ You have ${balance} LP position(s)\n`);

  if (balance === 0n) {
    console.log('❌ No positions found. Make sure:');
    console.log('   1. You created the position with this wallet');
    console.log('   2. You\'re on the correct network (Monad)');
    process.exit(0);
  }

  // 2. Get all position token IDs
  console.log('📋 Your positions:\n');
  
  for (let i = 0; i < Number(balance); i++) {
    const tokenId = await publicClient.readContract({
      address: CONTRACTS.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [walletAddress, BigInt(i)],
    });

    console.log(`Position #${i + 1}:`);
    console.log(`  Token ID: ${tokenId}\n`);

    // Try to get position details (this might fail if the ABI method name is different)
    try {
      const position = await publicClient.readContract({
        address: CONTRACTS.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positions',
        args: [tokenId],
      });

      const [poolId, tickLower, tickUpper] = position;
      console.log(`  Pool ID: ${poolId}`);
      console.log(`  Tick Range: ${tickLower} to ${tickUpper}`);
      
      // Calculate prices
      const priceLower = (Math.pow(1.0001, Number(tickLower)) * Math.pow(10, 12)).toFixed(8);
      const priceUpper = (Math.pow(1.0001, Number(tickUpper)) * Math.pow(10, 12)).toFixed(8);
      console.log(`  Price Range: ${priceLower} to ${priceUpper}\n`);

      console.log('💡 To use this position, update config.json:');
      console.log(`   "positionTokenId": ${tokenId},`);
      console.log(`   "position": {`);
      console.log(`     "tickLower": ${tickLower},`);
      console.log(`     "tickUpper": ${tickUpper},`);
      console.log(`     "priceRangeLower": ${priceLower},`);
      console.log(`     "priceRangeUpper": ${priceUpper}`);
      console.log(`   }\n`);
    } catch (error: any) {
      console.log(`  ⚠️ Could not fetch details: ${error.shortMessage || error.message?.split('\n')[0]}`);
      console.log(`  (Position exists but needs different query method)\n`);
    }
  }

} catch (error: any) {
  console.error('❌ Error:', error.shortMessage || error.message);
  console.log('\n💡 This might mean:');
  console.log('   - PositionManager contract is different on Monad');
  console.log('   - Position is managed differently (not NFT-based)');
  console.log('   - Need to query positions via a different method');
}

console.log('\n📝 Note: Since Uniswap v4 positions can be managed in different ways,');
console.log('if auto-detection fails, you can manually set the tick range in config.json');
console.log('based on what you see in the Uniswap UI.');
