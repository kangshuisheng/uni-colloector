#!/usr/bin/env bun
import { publicClient, CONTRACTS } from './config';
import { POOL_MANAGER_ABI } from './abis';
import { encodeAbiParameters, keccak256, type Address } from 'viem';

console.log('🔍 Searching for MON/AUSD Pool on Monad\n');

// Common scenarios for Monad native token
const possibleTokenAddresses = [
  // Native MON (often uses address(0) or wrapped version)
  '0x0000000000000000000000000000000000000000',
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Alternative native token representation
  
  // You'll need to find AUSD address - let's try some common stablecoin patterns
  // These are placeholders - we need the actual addresses
];

// Function to calculate Pool ID
function calculatePoolId(
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string
): string {
  const [token0, token1] = BigInt(currency0) < BigInt(currency1) 
    ? [currency0, currency1] 
    : [currency1, currency0];

  const poolKey = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }
    ],
    [token0 as `0x${string}`, token1 as `0x${string}`, fee, tickSpacing, hooks as `0x${string}`]
  );

  return keccak256(poolKey);
}

// Let's try to query the pool you provided to see what error we get
console.log('1️⃣ Testing your provided Pool ID:');
console.log('Pool ID:', '0xadaf30776f551bccdfb307c3fd8cdec198ca9a852434c8022ee32d1ccedd8219');

try {
  const result = await publicClient.readContract({
    address: CONTRACTS.poolManager,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: ['0xadaf30776f551bccdfb307c3fd8cdec198ca9a852434c8022ee32d1ccedd8219'],
  });
  console.log('✅ Pool found!', result);
} catch (error: any) {
  console.log('❌ Pool not found or not initialized\n');
  console.log('Error:', error.shortMessage || error.message);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📋 To help you find the correct pool, please:');
console.log('\n1. Open your position in Uniswap interface');
console.log('2. Click "View on Explorer" or find your position creation transaction');
console.log('3. Look for events like "Initialize" or "ModifyLiquidity"');
console.log('4. Copy the token addresses from the transaction\n');
console.log('Or provide me with:');
console.log('• The transaction hash where you created this LP position');
console.log('• Or screenshot showing the token addresses (not just symbols)\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Let's also check if we can find any pools by querying events
console.log('2️⃣ Attempting to find recent pool initializations...');
try {
  const latestBlock = await publicClient.getBlockNumber();
  console.log(`Current block: ${latestBlock}`);
  console.log('(This would require event scanning which needs the full event ABI)\n');
} catch (e) {
  console.log('Could not fetch latest block\n');
}

console.log('💡 Alternative approach:');
console.log('Since you created the LP in Uniswap UI, the interface must have the pool info.');
console.log('Can you:');
console.log('1. Open browser DevTools (F12) on the Uniswap page');
console.log('2. Go to Network tab');
console.log('3. Refresh your position page');
console.log('4. Look for API calls that show pool details');
console.log('5. Share any JSON response containing "currency0", "currency1", etc.\n');
