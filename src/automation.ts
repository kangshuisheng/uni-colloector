import { publicClient, walletClient, CONTRACTS, account } from "./config";
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI } from "./abis";
import { V3_NFT_MANAGER_ABI } from "./abis-v3";
import { formatUnits, pad, toHex } from "viem";
import { sendAutoActionAlert } from "./telegram";
import type {
  PositionConfig,
  V4PositionConfig,
  V3PositionConfig,
} from "./types";

export interface Fees {
  amount0: bigint;
  amount1: bigint;
  amount0Formatted: string;
  amount1Formatted: string;
}

/**
 * Get unclaimed fees for a position
 */
export async function getUnclaimedFees(config: PositionConfig): Promise<Fees> {
  if (config.protocol === "v4") {
    return getUnclaimedFeesV4(config as V4PositionConfig);
  } else {
    return getUnclaimedFeesV3(config as V3PositionConfig);
  }
}

async function getUnclaimedFeesV4(config: V4PositionConfig): Promise<Fees> {
  try {
    if (!config.positionTokenId)
      return {
        amount0: 0n,
        amount1: 0n,
        amount0Formatted: "0",
        amount1Formatted: "0",
      };

    const tokenId = config.positionTokenId;
    const poolId = config.poolId;
    const tickLower = config.tickLower;
    const tickUpper = config.tickUpper;
    const decimals0 = config.token0Decimals;
    const decimals1 = config.token1Decimals;

    // Use StateView to calculate fees off-chain to avoid simulation reverts
    const salt = pad(toHex(tokenId), { size: 32 });
    const owner = CONTRACTS.positionManager; // PositionManager owns the liquidity in the pool

    // 1. Get Position Info (Liquidity + Last Fee Growth)
    const [liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128] =
      await publicClient.readContract({
        address: CONTRACTS.stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getPositionInfo",
        args: [poolId, owner, tickLower, tickUpper, salt],
      });

    // 2. Get Current Fee Growth
    const [feeGrowthInside0X128, feeGrowthInside1X128] =
      await publicClient.readContract({
        address: CONTRACTS.stateView,
        abi: STATE_VIEW_ABI,
        functionName: "getFeeGrowthInside",
        args: [poolId, tickLower, tickUpper],
      });

    // 3. Calculate Unclaimed Fees
    const Q128 = 2n ** 128n;

    let feeGrowthDelta0 = feeGrowthInside0X128 - feeGrowthInside0LastX128;
    if (feeGrowthDelta0 < 0n) feeGrowthDelta0 += 2n ** 256n; // Handle wrap

    let feeGrowthDelta1 = feeGrowthInside1X128 - feeGrowthInside1LastX128;
    if (feeGrowthDelta1 < 0n) feeGrowthDelta1 += 2n ** 256n; // Handle wrap

    const amount0 = (feeGrowthDelta0 * liquidity) / Q128;
    const amount1 = (feeGrowthDelta1 * liquidity) / Q128;

    return {
      amount0,
      amount1,
      amount0Formatted: formatUnits(amount0, decimals0),
      amount1Formatted: formatUnits(amount1, decimals1),
    };
  } catch (error) {
    return {
      amount0: 0n,
      amount1: 0n,
      amount0Formatted: "0",
      amount1Formatted: "0",
    };
  }
}

async function getUnclaimedFeesV3(config: V3PositionConfig): Promise<Fees> {
  try {
    if (!config.nftId)
      return {
        amount0: 0n,
        amount1: 0n,
        amount0Formatted: "0",
        amount1Formatted: "0",
      };

    // In V3, we can simulate a collect call with 0 amount or MAX amount to see return value.
    // Or read 'tokensOwed0' and 'tokensOwed1' from 'positions' mapping.
    // 'positions' mapping is updated when liquidity is touched or burned.
    // To get real-time fees including those not yet checkpointed, we should simulate 'collect'.

    const { result } = await publicClient.simulateContract({
      address: config.nonfungiblePositionManagerAddress,
      abi: V3_NFT_MANAGER_ABI,
      functionName: "collect",
      args: [
        {
          tokenId: config.nftId,
          recipient: account.address, // Simulate sending to self
          amount0Max: 340282366920938463463374607431768211455n, // type(uint128).max
          amount1Max: 340282366920938463463374607431768211455n, // type(uint128).max
        },
      ],
      account: account.address,
    });

    const [amount0, amount1] = result;

    return {
      amount0,
      amount1,
      amount0Formatted: formatUnits(amount0, config.token0Decimals),
      amount1Formatted: formatUnits(amount1, config.token1Decimals),
    };
  } catch (error) {
    // console.error("Error fetching V3 fees:", error);
    return {
      amount0: 0n,
      amount1: 0n,
      amount0Formatted: "0",
      amount1Formatted: "0",
    };
  }
}

/**
 * Claim fees for a position
 */
export async function claimFees(config: PositionConfig, silent: boolean = false) {
  if (config.protocol === "v4") {
    return claimFeesV4(config as V4PositionConfig, silent);
  } else {
    return claimFeesV3(config as V3PositionConfig, silent);
  }
}

async function claimFeesV4(config: V4PositionConfig, silent: boolean) {
  if (!config.positionTokenId) return;
  const tokenId = config.positionTokenId;
  console.log(`Claiming fees for V4 position ${tokenId}...`);

  let fees: Fees | null = null;
  if (!silent) {
      fees = await getUnclaimedFeesV4(config);
  }

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

  if (!silent && fees) {
      await sendAutoActionAlert(
          "领取",
          config.name,
          fees.amount0Formatted,
          "T0",
          fees.amount1Formatted,
          "T1",
          hash
      );
  }
  
  return hash;
}

async function claimFeesV3(config: V3PositionConfig, silent: boolean) {
  if (!config.nftId) return;
  const tokenId = config.nftId;
  console.log(`Claiming fees for V3 position ${tokenId}...`);

  let fees: Fees | null = null;
  if (!silent) {
      fees = await getUnclaimedFeesV3(config);
  }

  const hash = await walletClient.writeContract({
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
    account,
  });

  console.log(`Transaction sent: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Fees claimed successfully!");

  if (!silent && fees) {
      await sendAutoActionAlert(
          "领取",
          config.name,
          fees.amount0Formatted,
          "T0",
          fees.amount1Formatted,
          "T1",
          hash
      );
  }

  return hash;
}

/**
 * Compound fees (Claim -> Add Liquidity)
 */
export async function compoundFees(config: PositionConfig) {
  console.log(`Compounding fees for position ${config.name}...`);

  // 1. Get estimated fees to know what we are compounding
  const fees = await getUnclaimedFees(config);
  const amount0ToAdd = fees.amount0;
  const amount1ToAdd = fees.amount1;

  if (amount0ToAdd === 0n && amount1ToAdd === 0n) {
    console.log("No fees to compound.");
    return;
  }

  // 2. Claim fees (silent, because we will alert for compound)
  await claimFees(config, true);

  // 3. Add Liquidity
  console.log(
    `Adding liquidity: ${fees.amount0Formatted} T0, ${fees.amount1Formatted} T1`
  );

  let txHash: string | undefined;

  if (config.protocol === "v4") {
    txHash = await increaseLiquidityV4(
      config as V4PositionConfig,
      amount0ToAdd,
      amount1ToAdd
    );
  } else {
    txHash = await increaseLiquidityV3(
      config as V3PositionConfig,
      amount0ToAdd,
      amount1ToAdd
    );
  }

  console.log("Compounding complete!");

  await sendAutoActionAlert(
    "复利",
    config.name,
    fees.amount0Formatted,
    "T0",
    fees.amount1Formatted,
    "T1",
    txHash
  );
}

async function increaseLiquidityV4(
  config: V4PositionConfig,
  amount0: bigint,
  amount1: bigint
) {
  if (!config.positionTokenId) return;

  const hash = await walletClient.writeContract({
    address: CONTRACTS.positionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "increaseLiquidity",
    args: [
      {
        tokenId: config.positionTokenId,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0n, // Slippage protection omitted for simplicity in this MVP
        amount1Min: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      },
    ],
    account,
  });

  console.log(`Increase Liquidity Tx: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function increaseLiquidityV3(
  config: V3PositionConfig,
  amount0: bigint,
  amount1: bigint
) {
  if (!config.nftId) return;

  const hash = await walletClient.writeContract({
    address: config.nonfungiblePositionManagerAddress,
    abi: V3_NFT_MANAGER_ABI,
    functionName: "increaseLiquidity",
    args: [
      {
        tokenId: config.nftId,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0n,
        amount1Min: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      },
    ],
    account,
  });

  console.log(`Increase Liquidity Tx: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Rebalance position
 */
export async function rebalancePosition(
  config: PositionConfig,
  newTickLower: number,
  newTickUpper: number
): Promise<bigint> {
  if (config.protocol === "v4") {
    return rebalancePositionV4(
      config as V4PositionConfig,
      newTickLower,
      newTickUpper
    );
  } else {
    return rebalancePositionV3(
      config as V3PositionConfig,
      newTickLower,
      newTickUpper
    );
  }
}

async function rebalancePositionV4(
  config: V4PositionConfig,
  newTickLower: number,
  newTickUpper: number
): Promise<bigint> {
  if (!config.positionTokenId) return 0n;
  const tokenId = config.positionTokenId;

  console.log(
    `Rebalancing V4 position ${tokenId} to range [${newTickLower}, ${newTickUpper}]...`
  );

  // 1. Get current liquidity
  const liquidity = await publicClient.readContract({
    address: CONTRACTS.positionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPositionLiquidity",
    args: [tokenId],
  });

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

  console.log(
    "Rebalance complete (Minting step pending implementation details)"
  );
  return 0n;
}

async function rebalancePositionV3(
  config: V3PositionConfig,
  newTickLower: number,
  newTickUpper: number
): Promise<bigint> {
  if (!config.nftId) return 0n;
  const tokenId = config.nftId;

  console.log(
    `Rebalancing V3 position ${tokenId} to range [${newTickLower}, ${newTickUpper}]...`
  );

  // 1. Get current liquidity
  const pos = await publicClient.readContract({
    address: config.nonfungiblePositionManagerAddress,
    abi: V3_NFT_MANAGER_ABI,
    functionName: "positions",
    args: [tokenId],
  });
  const liquidity = pos[7];

  if (liquidity > 0n) {
    // 2. Decrease Liquidity
    console.log("Removing liquidity...");
    const decreaseHash = await walletClient.writeContract({
      address: config.nonfungiblePositionManagerAddress,
      abi: V3_NFT_MANAGER_ABI,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity,
          amount0Min: 0n,
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
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: collectHash });

  console.log(
    "Rebalance complete (Minting step pending implementation details)"
  );
  return 0n;
}
