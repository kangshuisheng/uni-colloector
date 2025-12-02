#!/usr/bin/env bun
import { publicClient, CONTRACTS, POOL_CONFIG } from './config';
import { STATE_VIEW_ABI } from './abis';

console.log('🔍 Debugging Price Calculation\n');

const poolId = POOL_CONFIG.poolId;

try {
  const slot0 = await publicClient.readContract({
    address: CONTRACTS.stateView,
    abi: STATE_VIEW_ABI,
    functionName: 'getSlot0',
    args: [poolId],
  });

  const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0;

  console.log('Raw values:');
  console.log('  sqrtPriceX96:', sqrtPriceX96.toString());
  console.log('  tick:', tick.toString());
  console.log('  protocolFee:', protocolFee.toString());
  console.log('  lpFee:', lpFee.toString());
  console.log();

  // Method 1: From sqrtPriceX96
  const Q96 = 2n ** 96n;
  const sqrtPriceBigInt = sqrtPriceX96;
  const price1 = Number((sqrtPriceBigInt * sqrtPriceBigInt * 10n**18n) / (Q96 * Q96)) / 1e18;
  console.log('Method 1 (from sqrtPriceX96):', price1);

  // Method 2: From tick
  const tickNum = Number(tick);
  const price2 = Math.pow(1.0001, tickNum);
  console.log('Method 2 (from tick):', price2);

  // Method 3: More precise calculation
  const sqrtPriceNumber = Number(sqrtPriceX96) / Number(Q96);
  const price3 = sqrtPriceNumber * sqrtPriceNumber;
  console.log('Method 3 (precise):', price3);

  console.log('\n✅ Price should be around 0.029 based on your screenshot');
  console.log('Current tick:', tickNum, '→ Expected tick around:', Math.log(0.029) / Math.log(1.0001));

} catch (error) {
  console.error('Error:', error);
}
