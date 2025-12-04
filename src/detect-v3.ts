import { createPublicClient, http, defineChain } from "viem";
import { V3_NFT_MANAGER_ABI, V3_FACTORY_ABI } from "./abis-v3";
import { ERC20_ABI as ERC20_ABI_V4 } from "./abis";
import * as fs from "node:fs";
import * as path from "node:path";

export const monad = defineChain({
  id: 143,
  name: "Monad",
  network: "monad",
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
    public: { http: ["https://rpc.monad.xyz"] },
  },
});

const publicClient = createPublicClient({
  chain: monad,
  transport: http(),
});

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: bun run src/detect-v3.ts <NFT_MANAGER_ADDRESS> <TOKEN_ID>"
    );
    process.exit(1);
  }

  const nftManagerAddress = args[0] as `0x${string}`;
  const tokenId = BigInt(args[1]);

  console.log(
    `Fetching info for Token ID: ${tokenId} from ${nftManagerAddress}...`
  );

  try {
    const result = await publicClient.readContract({
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
    ] = result;

    // Get Factory
    const factoryAddress = await publicClient.readContract({
      address: nftManagerAddress,
      abi: V3_NFT_MANAGER_ABI,
      functionName: "factory",
    });
    console.log(`Factory: ${factoryAddress}`);

    // Get Pool Address
    const poolAddress = await publicClient.readContract({
      address: factoryAddress,
      abi: V3_FACTORY_ABI,
      functionName: "getPool",
      args: [token0, token1, fee],
    });
    console.log(`Pool Address: ${poolAddress}`);

    console.log("Position Details:");
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`Fee Tier: ${fee}`);
    console.log(`Tick Lower: ${tickLower}`);
    console.log(`Tick Upper: ${tickUpper}`);
    console.log(`Liquidity: ${liquidity}`);

    // Fetch Token Symbols and Decimals
    const token0Symbol = await publicClient.readContract({
      address: token0,
      abi: ERC20_ABI_V4,
      functionName: "symbol",
    });
    const token0Decimals = await publicClient.readContract({
      address: token0,
      abi: ERC20_ABI_V4,
      functionName: "decimals",
    });

    const token1Symbol = await publicClient.readContract({
      address: token1,
      abi: ERC20_ABI_V4,
      functionName: "symbol",
    });
    const token1Decimals = await publicClient.readContract({
      address: token1,
      abi: ERC20_ABI_V4,
      functionName: "decimals",
    });

    console.log("\n--- Configuration JSON ---");
    const config = {
      id: `v3-${tokenId}`,
      name: `${token0Symbol}/${token1Symbol} V3`,
      protocol: "v3",
      chainId: 143,
      token0Decimals: token0Decimals,
      token1Decimals: token1Decimals,
      poolAddress: poolAddress,
      nftId: tokenId.toString(),
      nonfungiblePositionManagerAddress: nftManagerAddress,
      tickLower: tickLower,
      tickUpper: tickUpper,
      automation: {
        enabled: true,
        autoClaim: true,
        autoCompound: true,
        autoRebalance: false,
        minFeeToClaimUSD: 5.0,
        rebalanceThresholdPercent: 10.0,
      },
    };

    console.log(JSON.stringify(config, null, 2));

    // Auto-save to config.json
    const configPath = path.resolve(process.cwd(), "config.json");

    try {
      let configFileContent = "{}";
      if (fs.existsSync(configPath)) {
        configFileContent = fs.readFileSync(configPath, "utf-8");
      }

      const currentConfig = JSON.parse(configFileContent);

      if (!currentConfig.positions) {
        currentConfig.positions = [];
      }

      // Check if exists
      const index = currentConfig.positions.findIndex(
        (p: any) => p.id === config.id
      );
      if (index !== -1) {
        console.log(`\n⚠️  Position ${config.id} already exists. Updating...`);
        currentConfig.positions[index] = config;
      } else {
        console.log(`\n✅  Appending new position to config.json...`);
        currentConfig.positions.push(config);
      }

      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
      console.log(`💾  Saved to ${configPath}`);
    } catch (e) {
      console.error("❌  Failed to update config.json:", e);
    }
  } catch (error) {
    console.error("Error fetching position:", error);
  }
}

main();
