#!/usr/bin/env bun
import { publicClient } from "./config";
import { ERC20_ABI } from "./abis";

console.log("🔍 Checking Token Decimals\n");

// From your screenshot, we can see the contract addresses:
// AUSD: 0x0000...012a (from the screenshot)
const ausdAddress = "0x0000000000000000000000000000000000000012a" as const; // Padded

// MON is likely the native token, but let's try to find wrapped MON
// Common patterns for native/wrapped tokens
const possibleMONAddresses = [
  "0x0000000000000000000000000000000000000000", // Native
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Alternative representation
] as const;

console.log("Checking AUSD token...");
try {
  const decimals = await publicClient.readContract({
    address: ausdAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  console.log(`✅ AUSD decimals: ${decimals}`);

  const symbol = await publicClient.readContract({
    address: ausdAddress,
    abi: ERC20_ABI,
    functionName: "symbol",
  });
  console.log(`✅ AUSD symbol: ${symbol}`);
} catch (error: any) {
  console.log(
    `❌ Failed: ${error.shortMessage || error.message?.split("\n")[0]}`
  );
}

console.log("\n💡 The price calculation needs to account for token decimals.");
console.log("If MON has 18 decimals and AUSD has 6 decimals:");
console.log("  Real price = raw_price * 10^(decimal0 - decimal1)");
console.log("  Real price = 2.8e-14 * 10^(18-6) = 2.8e-14 * 10^12 = 0.000028");
console.log(
  "\nStill seems wrong. Let me recalculate with the actual pool configuration...\n"
);

// Let's calculate what the price SHOULD be based on your screenshot (0.029 MON/AUSD)
const expectedPrice = 0.029;
const currentTick = -312023;
const rawPriceFromTick = Math.pow(1.0001, currentTick);

console.log("Expected price from screenshot: 0.029 MON/AUSD");
console.log("Current tick:", currentTick);
console.log("Raw price from tick:", rawPriceFromTick);
console.log();

// Try different decimal combinations
const decimalCombinations: [number, number, string][] = [
  [18, 18, "MON:18, AUSD:18"],
  [18, 6, "MON:18, AUSD:6"],
  [6, 18, "MON:6, AUSD:18"],
  [18, 8, "MON:18, AUSD:8"],
];

console.log("Testing decimal combinations:");
for (const [d0, d1, label] of decimalCombinations) {
  const adjustedPrice = rawPriceFromTick * Math.pow(10, d1 - d0);
  console.log(`  ${label}: ${adjustedPrice.toFixed(10)}`);
  if (Math.abs(adjustedPrice - expectedPrice) < 0.001) {
    console.log(
      `    ✅ Match! This is likely the correct decimal configuration`
    );
  }
}
