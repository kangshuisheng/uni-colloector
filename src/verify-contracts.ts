#!/usr/bin/env bun
import { publicClient } from "./config";
import { parseAbi } from "viem";

console.log("🔍 Investigating Contract Addresses and Pool Query\n");

// The pool ID from your screenshot
const poolId =
  "0xadaf30776f551bccdfb307c3fd8cdec198ca9a852434c8022ee32d1ccedd8219";

// Let's try different contract addresses and ABIs
const addressesToTry = [
  {
    name: "PoolManager (from docs)",
    address: "0x188d586ddcf52439676ca21a244753fa19f9ea8e",
    // Try simpler ABI - directly from v4-core
    abi: parseAbi([
      "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
      "function getLiquidity(bytes32 id) external view returns (uint128 liquidity)",
    ]),
  },
  {
    name: "StateView (from docs)",
    address: "0x77395f3b2e73ae90843717371294fa97cc419d64",
    abi: parseAbi([
      "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    ]),
  },
];

console.log("Testing different contract addresses:\n");

for (const contract of addressesToTry) {
  console.log(`━━━ ${contract.name} ━━━`);
  console.log(`Address: ${contract.address}`);

  // First check if contract exists
  try {
    const code = await publicClient.getBytecode({
      address: contract.address as `0x${string}`,
    });
    if (!code || code === "0x") {
      console.log("❌ No contract at this address\n");
      continue;
    }
    console.log(`✅ Contract exists (${code.length} bytes)`);
  } catch (e) {
    console.log("❌ Failed to check contract\n");
    continue;
  }

  // Try to call getSlot0
  try {
    const result = await publicClient.readContract({
      address: contract.address as `0x${string}`,
      abi: contract.abi,
      functionName: "getSlot0",
      args: [poolId],
    });

    console.log("🎉 SUCCESS! Pool data retrieved:");
    console.log("  sqrtPriceX96:", result[0].toString());
    console.log("  tick:", result[1].toString());
    console.log("  protocolFee:", result[2].toString());
    console.log("  lpFee:", result[3].toString());

    // Calculate price from tick
    const tick = Number(result[1]);
    const price = Math.pow(1.0001, tick);
    console.log("  Calculated price:", price.toFixed(8));
    console.log("\n✅ This is the correct contract to use!\n");
    break;
  } catch (error: any) {
    console.log(
      "❌ Call failed:",
      error.shortMessage || error.message?.split("\n")[0]
    );
  }
  console.log();
}

console.log("\n💡 If all attempts failed, the issue might be:");
console.log("1. The pool ID format is different (not bytes32)");
console.log("2. The RPC endpoint has limitations");
console.log(
  "3. We need to query via a different method (e.g., PositionManager)"
);
console.log("\nLet me check the Uniswap v4 deployment addresses for Monad...");
