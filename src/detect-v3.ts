#!/usr/bin/env bun
import { publicClient } from "./config";
import { V3_NFT_MANAGER_ABI, V3_FACTORY_ABI } from "./abis-v3";
import { ERC20_ABI } from "./abis";
import type { Address } from "viem";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log(
    "Usage: bun run src/detect-v3.ts <NFT_MANAGER_ADDRESS> <TOKEN_ID>"
  );
  process.exit(1);
}

const nftManagerAddress = args[0] as Address;
const tokenId = BigInt(args[1]);

console.log(
  `🔍 Detecting V3 Position for Token ID ${tokenId} on ${nftManagerAddress}...\n`
);

try {
  // 1. Get Position Details
  const position = await publicClient.readContract({
    address: nftManagerAddress,
    abi: V3_NFT_MANAGER_ABI,
    functionName: "positions",
    args: [tokenId],
  });

  const [
    nonce,
    operator,
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    liquidity,
  ] = position;

  console.log(`✅ Position Found!`);
  console.log(`   Token0: ${token0}`);
  console.log(`   Token1: ${token1}`);
  console.log(`   Fee: ${fee}`);
  console.log(`   Tick Range: ${tickLower} to ${tickUpper}`);
  console.log(`   Liquidity: ${liquidity}`);

  // 2. Get Token Decimals
  const decimals0 = await publicClient.readContract({
    address: token0,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  const symbol0 = await publicClient.readContract({
    address: token0,
    abi: ERC20_ABI,
    functionName: "symbol",
  });

  const decimals1 = await publicClient.readContract({
    address: token1,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  const symbol1 = await publicClient.readContract({
    address: token1,
    abi: ERC20_ABI,
    functionName: "symbol",
  });

  console.log(`   Token0 Info: ${symbol0} (${decimals0} decimals)`);
  console.log(`   Token1 Info: ${symbol1} (${decimals1} decimals)`);

  // 3. Get Factory and Pool Address
  const factoryAddress = await publicClient.readContract({
    address: nftManagerAddress,
    abi: V3_NFT_MANAGER_ABI,
    functionName: "factory",
  });
  console.log(`   Factory: ${factoryAddress}`);

  const poolAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: V3_FACTORY_ABI,
    functionName: "getPool",
    args: [token0, token1, fee],
  });
  console.log(`   Pool Address: ${poolAddress}\n`);

  // 4. Generate Config
  console.log('💡 Add this to "positions" in config.json:');
  console.log(
    JSON.stringify(
      {
        id: `v3-${tokenId}`,
        name: `${symbol0}/${symbol1} V3`,
        protocol: "v3",
        chainId: 143,
        token0Decimals: decimals0,
        token1Decimals: decimals1,
        poolAddress: poolAddress,
        nftId: tokenId.toString(),
        nonfungiblePositionManagerAddress: nftManagerAddress,
        tickLower: Number(tickLower),
        tickUpper: Number(tickUpper),
        automation: {
          enabled: false,
          autoClaim: false,
          autoCompound: false,
          autoRebalance: false,
          minFeeToClaimUSD: 5.0,
          rebalanceThresholdPercent: 10.0,
        },
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("❌ Error fetching V3 position:", error);
}
