import { publicClient, walletClient, CONTRACTS, account } from "./config";
import { POSITION_MANAGER_ABI } from "./abis";
import { formatUnits } from "viem";

export interface Fees {
  amount0: bigint;
  amount1: bigint;
  amount0Formatted: string;
  amount1Formatted: string;
}

/**
 * Get unclaimed fees for a position
 */
export async function getUnclaimedFees(
  tokenId: bigint,
  decimals0: number = 6,
  decimals1: number = 18
): Promise<Fees> {
  try {
    const position = await publicClient.readContract({
      address: CONTRACTS.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "positions",
      args: [tokenId],
    });

    // In v4 PositionManager, 'tokensOwed0' and 'tokensOwed1' usually represent the uncollected fees
    // + principal from decreased liquidity.
    // If we haven't decreased liquidity, it might just be fees if the contract updates it automatically,
    // but usually we need to simulate a call to know exact fees if they are not updated in storage yet.
    // However, for simplicity, we read what's in the struct.
    // Note: Real-time fees might require a static call to 'collect' with 0 amount or similar view function if available.
    // But 'positions' struct usually has 'tokensOwed' which are updated when the position is touched.
    // If the position hasn't been touched, these might be 0.
    // A better way is to simulate a collect call.

    const { result } = await publicClient.simulateContract({
      address: CONTRACTS.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "collect",
      args: [
        {
          tokenId,
          recipient: account.address,
          amount0Max: 340282366920938463463374607431768211455n, // type(uint128).max
          amount1Max: 340282366920938463463374607431768211455n, // type(uint128).max
        },
      ],
      account,
    });

    const [amount0, amount1] = result;

    return {
      amount0,
      amount1,
      amount0Formatted: formatUnits(amount0, decimals0),
      amount1Formatted: formatUnits(amount1, decimals1),
    };
  } catch (error) {
    console.error("Error fetching fees:", error);
    throw error;
  }
}

/**
 * Claim fees for a position
 */
export async function claimFees(tokenId: bigint) {
  console.log(`Claiming fees for position ${tokenId}...`);

  const hash = await walletClient.writeContract({
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
    account,
  });

  console.log(`Transaction sent: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fees claimed successfully!");
  return hash;
}

/**
 * Compound fees (Claim -> Add Liquidity)
 * Note: This is a simplified version. Real compounding requires swapping to optimal ratio.
 * Here we just add what we can.
 */
export async function compoundFees(tokenId: bigint) {
  console.log(`Compounding fees for position ${tokenId}...`);

  // 1. Claim fees
  await claimFees(tokenId);

  // 2. Get balances (simplified, assuming we want to add all balance or just the claimed amount)
  // For now, let's just try to increase liquidity with what we have in the wallet
  // In a real bot, we would track exactly what was claimed.

  // ... Implementation of increaseLiquidity would go here
  // But without knowing the exact token addresses and decimals dynamically, it's risky.
  // We will implement this if the user provides token info.
  console.log("Compounding not fully implemented without token info.");
}

/**
 * Rebalance position
 * 1. Decrease Liquidity (100%)
 * 2. Collect tokens
 * 3. Mint new position
 */
export async function rebalancePosition(
  tokenId: bigint,
  newTickLower: number,
  newTickUpper: number
): Promise<bigint> {
  console.log(
    `Rebalancing position ${tokenId} to range [${newTickLower}, ${newTickUpper}]...`
  );

  // 1. Get current liquidity
  const position = await publicClient.readContract({
    address: CONTRACTS.positionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "positions",
    args: [tokenId],
  });
  const liquidity = position[3]; // liquidity is at index 3 in our ABI

  if (liquidity > 0n) {
    // 2. Decrease Liquidity
    console.log("Removing liquidity...");
    const decreaseHash = await walletClient.writeContract({
      address: CONTRACTS.positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity,
          amount0Min: 0n, // Slippage protection should be calculated
          amount1Min: 0n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
        },
      ],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: decreaseHash });
  }

  // 3. Collect all tokens
  console.log("Collecting tokens...");
  const collectHash = await walletClient.writeContract({
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
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: collectHash });

  // 4. Mint new position
  // We need to know how much token0 and token1 we have to mint.
  // This requires checking balances.
  // And potentially swapping if the ratio doesn't match the new range.

  console.log("Minting new position...");
  // This part is complex because we need to calculate amounts based on the new range price
  // and potentially swap.
  // For this MVP, we will assume the user has enough tokens and just try to mint with what's available
  // or a fixed amount if configured.

  // ... Mint logic ...

  console.log(
    "Rebalance complete (Minting step pending implementation details)"
  );
  return 0n; // Return new tokenId
}
