import { publicClient, account, CONTRACTS } from "./config";
import { POSITIONS } from "./config";
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI, ERC20_ABI } from "./abis";
import { V3_NFT_MANAGER_ABI } from "./abis-v3";
import { getUnclaimedFees } from "./automation";
import { formatUnits, pad, toHex } from "viem";
import type { V4PositionConfig, V3PositionConfig } from "./types";

async function main() {
  console.log("🧪 Starting Simulation Test...");
  console.log(
    "This script will SIMULATE transactions without spending gas or moving funds."
  );
  console.log(
    "------------------------------------------------------------------------"
  );

  if (POSITIONS.length === 0) {
    console.error("No positions found in config.json");
    return;
  }

  // Select the last position (likely the one just added) or let user choose via args
  // For now, let's test the V3 position we just added if it exists, or the first one.
  const position = POSITIONS[POSITIONS.length - 1];
  console.log(
    `Target Position: ${position.name} (${position.protocol.toUpperCase()})`
  );
  console.log(`ID: ${position.id}`);

  if (position.protocol === "v3") {
    await simulateV3(position as V3PositionConfig);
  } else {
    await simulateV4(position as V4PositionConfig);
  }
}

async function simulateV3(config: V3PositionConfig) {
  const tokenId = config.nftId;
  if (!tokenId) return;

  console.log(
    "\n--- Simulating V3 Compound (Collect + Increase Liquidity) ---"
  );

  // 1. Simulate Collect (Claim Fees)
  try {
    const { result: collectResult } = await publicClient.simulateContract({
      address: config.nonfungiblePositionManagerAddress,
      abi: V3_NFT_MANAGER_ABI,
      functionName: "collect",
      args: [
        {
          tokenId,
          recipient: account.address,
          amount0Max: 340282366920938463463374607431768211455n,
          amount1Max: 340282366920938463463374607431768211455n,
        },
      ],
      account: account.address,
    });
    const [amount0, amount1] = collectResult;
    console.log(`✅ Collect Simulation Successful!`);
    console.log(
      `   Would claim: ${formatUnits(
        amount0,
        config.token0Decimals
      )} T0, ${formatUnits(amount1, config.token1Decimals)} T1`
    );

    if (amount0 > 0n || amount1 > 0n) {
      // 2. Simulate Increase Liquidity (Compound)
      // NOTE: This simulation will FAIL with "STF" (Safe Transfer Failed) if the wallet
      // does not have enough allowance for the PositionManager.
      // In a real run, our automation.ts handles approval.
      // In this simulation, we can't easily simulate approval + increase in one go without a fork.
      // So we will check allowance first to explain the failure if it happens.

      const pos = await publicClient.readContract({
        address: config.nonfungiblePositionManagerAddress,
        abi: V3_NFT_MANAGER_ABI,
        functionName: "positions",
        args: [tokenId],
      });
      const token0 = pos[2];
      const token1 = pos[3];

      const allowance0 = await publicClient.readContract({
        address: token0,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account.address, config.nonfungiblePositionManagerAddress],
      });
      const allowance1 = await publicClient.readContract({
        address: token1,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account.address, config.nonfungiblePositionManagerAddress],
      });

      if (allowance0 < amount0 || allowance1 < amount1) {
        console.log(
          `⚠️  Cannot simulate IncreaseLiquidity fully because of missing approvals.`
        );
        console.log(
          `   This is EXPECTED in simulation if you haven't approved yet.`
        );
        console.log(`   Real execution will handle approvals automatically.`);
        console.log(`   Allowance T0: ${allowance0}, Needed: ${amount0}`);
        console.log(`   Allowance T1: ${allowance1}, Needed: ${amount1}`);
      } else {
        try {
          const { result: increaseResult } =
            await publicClient.simulateContract({
              address: config.nonfungiblePositionManagerAddress,
              abi: V3_NFT_MANAGER_ABI,
              functionName: "increaseLiquidity",
              args: [
                {
                  tokenId,
                  amount0Desired: amount0,
                  amount1Desired: amount1,
                  amount0Min: 0n,
                  amount1Min: 0n,
                  deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
                },
              ],
              account: account.address,
            });
          console.log(`✅ Increase Liquidity Simulation Successful!`);
          console.log(`   Would add liquidity: ${increaseResult[0]}`);
        } catch (e) {
          console.error(`❌ Increase Liquidity Simulation Failed:`, e);
        }
      }
    } else {
      console.log(
        "   Skipping Increase Liquidity simulation (no fees to compound)."
      );
    }
  } catch (e) {
    console.error(`❌ Collect Simulation Failed:`, e);
  }

  console.log("\n--- Simulating V3 Remove Liquidity (Decrease Liquidity) ---");

  // 1. Get Liquidity
  const pos = await publicClient.readContract({
    address: config.nonfungiblePositionManagerAddress,
    abi: V3_NFT_MANAGER_ABI,
    functionName: "positions",
    args: [tokenId],
  });
  const liquidity = pos[7];
  console.log(`Current Liquidity: ${liquidity}`);

  if (liquidity > 0n) {
    // Simulate removing 10%
    const liquidityToRemove = liquidity / 10n;
    try {
      const { result: decreaseResult } = await publicClient.simulateContract({
        address: config.nonfungiblePositionManagerAddress,
        abi: V3_NFT_MANAGER_ABI,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId,
            liquidity: liquidityToRemove,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
          },
        ],
        account: account.address,
      });
      console.log(`✅ Decrease Liquidity (10%) Simulation Successful!`);
      console.log(
        `   Would receive: ${formatUnits(
          decreaseResult[0],
          config.token0Decimals
        )} T0, ${formatUnits(decreaseResult[1], config.token1Decimals)} T1`
      );
    } catch (e) {
      console.error(`❌ Decrease Liquidity Simulation Failed:`, e);
    }
  } else {
    console.log("   No liquidity to remove.");
  }
}

async function simulateV4(config: V4PositionConfig) {
  const tokenId = config.positionTokenId;
  if (!tokenId) return;

  console.log(
    "\n--- Simulating V4 Compound (Collect + Increase Liquidity) ---"
  );

  // 1. Simulate Collect (Claim Fees)
  try {
    const { result: collectResult } = await publicClient.simulateContract({
      address: CONTRACTS.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "collect",
      args: [
        {
          tokenId,
          recipient: account.address,
          amount0Max: 340282366920938463463374607431768211455n,
          amount1Max: 340282366920938463463374607431768211455n,
        },
      ],
      account: account.address,
    });
    const [amount0, amount1] = collectResult;
    console.log(`✅ Collect Simulation Successful!`);
    console.log(
      `   Would claim: ${formatUnits(
        amount0,
        config.token0Decimals
      )} T0, ${formatUnits(amount1, config.token1Decimals)} T1`
    );

    if (amount0 > 0n || amount1 > 0n) {
      // 2. Simulate Increase Liquidity (Compound)
      try {
        const { result: increaseResult } = await publicClient.simulateContract({
          address: CONTRACTS.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: "increaseLiquidity",
          args: [
            {
              tokenId,
              amount0Desired: amount0,
              amount1Desired: amount1,
              amount0Min: 0n,
              amount1Min: 0n,
              deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
            },
          ],
          account: account.address,
        });
        console.log(`✅ Increase Liquidity Simulation Successful!`);
        console.log(`   Would add liquidity: ${increaseResult[0]}`);
      } catch (e) {
        console.error(`❌ Increase Liquidity Simulation Failed:`, e);
      }
    } else {
      console.log(
        "   Skipping Increase Liquidity simulation (no fees to compound)."
      );
    }
  } catch (e) {
    console.error(`❌ Collect Simulation Failed:`, e);
  }

  console.log("\n--- Simulating V4 Remove Liquidity (Decrease Liquidity) ---");

  // 1. Get Liquidity
  const liquidity = await publicClient.readContract({
    address: CONTRACTS.positionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPositionLiquidity",
    args: [tokenId],
  });
  console.log(`Current Liquidity: ${liquidity}`);

  if (liquidity > 0n) {
    // Simulate removing 10%
    const liquidityToRemove = liquidity / 10n;
    try {
      const { result: decreaseResult } = await publicClient.simulateContract({
        address: CONTRACTS.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId,
            liquidity: liquidityToRemove,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
          },
        ],
        account: account.address,
      });
      console.log(`✅ Decrease Liquidity (10%) Simulation Successful!`);
      console.log(
        `   Would receive: ${formatUnits(
          decreaseResult[0],
          config.token0Decimals
        )} T0, ${formatUnits(decreaseResult[1], config.token1Decimals)} T1`
      );
    } catch (e) {
      console.error(`❌ Decrease Liquidity Simulation Failed:`, e);
    }
  } else {
    console.log("   No liquidity to remove.");
  }
}

main();
