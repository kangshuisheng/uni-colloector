#!/usr/bin/env bun
import { POOL_CONFIG, tickToPrice } from './config';

console.log('🔍 Checking Position Range Logic\n');

const currentPrice = 0.02822862;
const currentTick = -312023;

console.log('Current Status:');
console.log(`  Price: ${currentPrice}`);
console.log(`  Tick: ${currentTick}\n`);

console.log('Configured Range:');
console.log(`  tickLower: ${POOL_CONFIG.position.tickLower}`);
console.log(`  tickUpper: ${POOL_CONFIG.position.tickUpper}`);
console.log(`  priceRangeLower: ${POOL_CONFIG.position.priceRangeLower}`);
console.log(`  priceRangeUpper: ${POOL_CONFIG.position.priceRangeUpper}\n`);

// Convert ticks to prices (with decimal adjustment)
const priceLowerFromTick = Math.pow(1.0001, POOL_CONFIG.position.tickLower) * Math.pow(10, 12);
const priceUpperFromTick = Math.pow(1.0001, POOL_CONFIG.position.tickUpper) * Math.pow(10, 12);

console.log('Prices from Ticks (with decimal adjustment):');
console.log(`  Lower: ${priceLowerFromTick.toFixed(8)}`);
console.log(`  Upper: ${priceUpperFromTick.toFixed(8)}\n`);

console.log('Check 1 - Tick-based:');
console.log(`  ${POOL_CONFIG.position.tickLower} <= ${currentTick} <= ${POOL_CONFIG.position.tickUpper}`);
const inRangeByTick = currentTick >= POOL_CONFIG.position.tickLower && currentTick <= POOL_CONFIG.position.tickUpper;
console.log(`  Result: ${inRangeByTick ? '✅ IN RANGE' : '❌ OUT OF RANGE'}\n`);

console.log('Check 2 - Price-based (configured prices):');
console.log(`  ${POOL_CONFIG.position.priceRangeLower} <= ${currentPrice} <= ${POOL_CONFIG.position.priceRangeUpper}`);
const inRangeByConfigPrice = currentPrice >= POOL_CONFIG.position.priceRangeLower && currentPrice <= POOL_CONFIG.position.priceRangeUpper;
console.log(`  Result: ${inRangeByConfigPrice ? '✅ IN RANGE' : '❌ OUT OF RANGE'}\n`);

console.log('Check 3 - Price-based (from ticks):');
console.log(`  ${priceLowerFromTick.toFixed(8)} <= ${currentPrice} <= ${priceUpperFromTick.toFixed(8)}`);
const inRangeByTickPrice = currentPrice >= priceLowerFromTick && currentPrice <= priceUpperFromTick;
console.log(`  Result: ${inRangeByTickPrice ? '✅ IN RANGE' : '❌ OUT OF RANGE'}\n`);

console.log('💡 The configured price range (0.018 - 0.039) seems wrong!');
console.log('   Current price 0.028 should be INSIDE that range.');
console.log('   But the ticks (-37340 to 37000) convert to completely different prices!');
console.log('   This suggests the config.json has incorrect values.\n');

console.log('📝 Recommendation: Use tick-based comparison, which is authoritative.');
