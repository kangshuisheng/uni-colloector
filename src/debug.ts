#!/usr/bin/env bun
import { publicClient, CONTRACTS, POOL_CONFIG } from './config';

console.log('🔍 Debugging Connection and Contracts\n');

try {
  // 1. Check RPC connection
  console.log('1️⃣ Testing RPC connection...');
  const blockNumber = await publicClient.getBlockNumber();
  console.log(`✅ Connected! Current block: ${blockNumber}\n`);

  // 2. Check PoolManager contract
  console.log('2️⃣ Testing PoolManager contract...');
  console.log(`PoolManager address: ${CONTRACTS.poolManager}`);
  
  const code = await publicClient.getBytecode({
    address: CONTRACTS.poolManager,
  });
  
  if (code && code !== '0x') {
    console.log(`✅ PoolManager contract exists (${code.length} bytes)\n`);
  } else {
    console.log(`❌ PoolManager contract not found at ${CONTRACTS.poolManager}\n`);
  }

  // 3. Check Pool ID
  console.log('3️⃣ Pool configuration:');
  console.log(`Pool ID: ${POOL_CONFIG.poolId}`);
  console.log(`Position range: ${POOL_CONFIG.position.tickLower} to ${POOL_CONFIG.position.tickUpper}`);
  console.log(`Price range: ${POOL_CONFIG.position.priceRangeLower} to ${POOL_CONFIG.position.priceRangeUpper}\n`);

  console.log('ℹ️  Note: If getSlot0 reverts, it likely means:');
  console.log('   - The pool ID does not exist on this chain');
  console.log('   - The pool has not been initialized yet');
  console.log('   - The RPC URL is pointing to a different network\n');
  
  console.log('💡 Suggestion: Please verify your pool ID from the Uniswap v4 interface');
  console.log('   or provide the actual currency addresses, fee tier, and hook address');
  console.log('   so we can compute the correct pool ID.');

} catch (error) {
  console.error('\n❌ Debug failed:', error);
  process.exit(1);
}
