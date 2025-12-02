#!/usr/bin/env bun
import { encodeAbiParameters, keccak256 } from 'viem';

console.log('🧮 Uniswap v4 Pool ID Calculator\n');

// From your screenshot: MON / AUSD pool
// You need to provide the actual token addresses

console.log('To calculate the correct Pool ID, we need:');
console.log('1. Currency0 address (e.g., MON token address)');
console.log('2. Currency1 address (e.g., AUSD token address)');
console.log('3. Fee tier (e.g., 500 for 0.05%, 3000 for 0.30%)');
console.log('4. Tick spacing (usually 10 for 0.05%, 60 for 0.30%)');
console.log('5. Hook address (0x0000000000000000000000000000000000000000 if no hook)\n');

console.log('📝 Example usage:');
console.log('```typescript');
console.log('const poolKey = {');
console.log('  currency0: "0x..." as Address, // MON token');
console.log('  currency1: "0x..." as Address, // AUSD token');
console.log('  fee: 500,                       // 0.05%');
console.log('  tickSpacing: 10,');
console.log('  hooks: "0x0000000000000000000000000000000000000000" as Address');
console.log('};');
console.log('```\n');

// Function to calculate pool ID
export function calculatePoolId(
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string
): string {
  // PoolKey must have currency0 < currency1
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

// Example calculation (you need to replace with your actual addresses)
const exampleCurrency0 = '0x0000000000000000000000000000000000000000'; // Replace with MON
const exampleCurrency1 = '0x0000000000000000000000000000000000000001'; // Replace with AUSD
const exampleFee = 500; // 0.05% from screenshot
const exampleTickSpacing = 10;
const exampleHooks = '0x0000000000000000000000000000000000000000';

const calculatedPoolId = calculatePoolId(
  exampleCurrency0,
  exampleCurrency1,
  exampleFee,
  exampleTickSpacing,
  exampleHooks
);

console.log('📊 Example calculation (with placeholder addresses):');
console.log(`Pool ID: ${calculatedPoolId}\n`);

console.log('❗ Action Required:');
console.log('Please provide your actual MON and AUSD token addresses from the Uniswap interface.');
console.log('You can find them by:');
console.log('1. Clicking on your position details');
console.log('2. Looking at the transaction that created the position');
console.log('3. Finding the token contract addresses');
