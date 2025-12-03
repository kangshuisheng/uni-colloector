import { publicClient, CONTRACTS, isInRange } from "./config";
import { STATE_VIEW_ABI, POSITION_MANAGER_ABI } from "./abis";
import { V3_POOL_ABI, V3_NFT_MANAGER_ABI } from "./abis-v3";
import type {
  PositionConfig,
  V4PositionConfig,
  V3PositionConfig,
  PositionStatus,
} from "./types";
import { getUnclaimedFees } from "./automation";
import { Token, CurrencyAmount } from "@uniswap/sdk-core";
import { Pool as PoolV4, Position as PositionV4 } from "@uniswap/v4-sdk";
import { Pool as PoolV3, Position as PositionV3 } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

// Helper to convert BigInt to JSBI
function toJSBI(val: bigint): JSBI {
  return JSBI.BigInt(val.toString());
}

/**
 * Check position status based on configuration
 */
export async function checkPosition(
  config: PositionConfig
): Promise<PositionStatus> {
  if (config.protocol === "v4") {
    return checkV4Position(config as V4PositionConfig);
  } else {
    return checkV3Position(config as V3PositionConfig);
  }
}

/**
 * Check V4 Position
 */
async function checkV4Position(
  config: V4PositionConfig
): Promise<PositionStatus> {
  try {
    // Get slot0 from StateView
    const slot0 = await publicClient.readContract({
      address: CONTRACTS.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getSlot0",
      args: [config.poolId],
    });

    const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0;
    const currentTick = Number(tick);

    // Get Liquidity
    let liquidity = 0n;
    if (config.positionTokenId) {
      const pos = await publicClient.readContract({
        address: CONTRACTS.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: "positions",
        args: [config.positionTokenId],
      });
      liquidity = pos[3];
    }

    return calculateStatusV4(config, currentTick, sqrtPriceX96, liquidity);
  } catch (error) {
    console.error(`Error checking V4 position ${config.name}:`, error);
    throw error;
  }
}

/**
 * Check V3 Position
 */
async function checkV3Position(
  config: V3PositionConfig
): Promise<PositionStatus> {
  try {
    // Get slot0 from Pool Contract
    const slot0 = await publicClient.readContract({
      address: config.poolAddress,
      abi: V3_POOL_ABI,
      functionName: "slot0",
    });

    const [sqrtPriceX96, tick] = slot0;
    const currentTick = Number(tick);

    // Get Liquidity and Fee
    let liquidity = 0n;
    let fee = 3000; // Default to 0.3% if not found

    if (config.nftId) {
      const pos = await publicClient.readContract({
        address: config.nonfungiblePositionManagerAddress,
        abi: V3_NFT_MANAGER_ABI,
        functionName: "positions",
        args: [config.nftId],
      });
      liquidity = pos[7]; // liquidity is at index 7 in V3 ABI
      fee = pos[4];       // fee is at index 4
    }

    return calculateStatusV3(config, currentTick, sqrtPriceX96, liquidity, fee);
  } catch (error) {
    console.error(`Error checking V3 position ${config.name}:`, error);
    throw error;
  }
}

async function calculateStatusV4(
  config: V4PositionConfig,
  currentTick: number,
  sqrtPriceX96: bigint,
  liquidity: bigint
): Promise<PositionStatus> {
  const { tickLower, tickUpper } = config;
  const chainId = 143; // Monad Testnet

  // Create Tokens
  const token0 = new Token(chainId, "0x0000000000000000000000000000000000000000", config.token0Decimals, "T0", "Token0");
  const token1 = new Token(chainId, "0x0000000000000000000000000000000000000001", config.token1Decimals, "T1", "Token1");

  // Create Pool
  // V4 Pool Constructor: currencyA, currencyB, fee, tickSpacing, hooks, sqrtRatioX96, liquidity, tickCurrent
  const pool = new PoolV4(
    token0,
    token1,
    3000, // Dummy fee
    60,   // Dummy tickSpacing
    "0x0000000000000000000000000000000000000000", // Dummy hooks
    toJSBI(sqrtPriceX96),
    toJSBI(0n), // Pool liquidity (global) - not needed for position amount calc usually, but required by constructor
    currentTick
  );

  // Calculate Price
  const priceToken0 = pool.token0Price;
  const currentPrice = parseFloat(priceToken0.toSignificant(6));

  // Calculate Amounts
  let amount0 = 0;
  let amount1 = 0;
  
  if (liquidity > 0n) {
    const position = new PositionV4({
      pool,
      liquidity: toJSBI(liquidity),
      tickLower,
      tickUpper
    });
    amount0 = parseFloat(position.amount0.toExact());
    amount1 = parseFloat(position.amount1.toExact());
  }

  return buildStatus(config, currentTick, currentPrice, amount0, amount1, liquidity);
}

async function calculateStatusV3(
  config: V3PositionConfig,
  currentTick: number,
  sqrtPriceX96: bigint,
  liquidity: bigint,
  fee: number
): Promise<PositionStatus> {
  const { tickLower, tickUpper } = config;
  const chainId = 1; // Dummy chainId

  // Create Tokens
  const token0 = new Token(chainId, "0x0000000000000000000000000000000000000000", config.token0Decimals, "T0", "Token0");
  const token1 = new Token(chainId, "0x0000000000000000000000000000000000000001", config.token1Decimals, "T1", "Token1");

  // Create Pool
  // V3 Pool Constructor: tokenA, tokenB, fee, sqrtRatioX96, liquidity, tickCurrent
  const pool = new PoolV3(
    token0,
    token1,
    fee, 
    toJSBI(sqrtPriceX96),
    toJSBI(0n), // Pool liquidity
    currentTick
  );

  // Calculate Price
  const priceToken0 = pool.token0Price;
  const currentPrice = parseFloat(priceToken0.toSignificant(6));

  // Calculate Amounts
  let amount0 = 0;
  let amount1 = 0;

  if (liquidity > 0n) {
    const position = new PositionV3({
      pool,
      liquidity: toJSBI(liquidity),
      tickLower,
      tickUpper
    });
    amount0 = parseFloat(position.amount0.toExact());
    amount1 = parseFloat(position.amount1.toExact());
  }

  return buildStatus(config, currentTick, currentPrice, amount0, amount1, liquidity);
}


async function buildStatus(
  config: PositionConfig,
  currentTick: number,
  currentPrice: number,
  amount0: number,
  amount1: number,
  liquidity: bigint
): Promise<PositionStatus> {
  const { tickLower, tickUpper } = config;

  // Calculate Price Range
  // We can use SDK to get price at ticks, but simple math is fine for display
  const priceLower = Math.pow(1.0001, tickLower) * Math.pow(10, config.token0Decimals - config.token1Decimals);
  const priceUpper = Math.pow(1.0001, tickUpper) * Math.pow(10, config.token0Decimals - config.token1Decimals);

  const inRange = isInRange(currentTick, tickLower, tickUpper);

  // Calculate Deviation
  let deviationPercent = 0;
  if (!inRange) {
    if (currentTick < tickLower) {
      deviationPercent = ((priceLower - currentPrice) / priceLower) * 100;
    } else {
      deviationPercent = ((currentPrice - priceUpper) / priceUpper) * 100;
    }
  }

  // --- Analytics ---
  let currentValueUSD = 0;
  let apr = 0;
  let roi = 0;
  let daysToBreakeven = 0;
  let feesPendingUSD = 0;

  if (liquidity > 0n) {
    // Estimate Value
    const token1Price = config.analytics?.token1PriceUSD || 1.0;
    const token0Price = currentPrice * token1Price;
    
    currentValueUSD = (amount0 * token0Price) + (amount1 * token1Price);

    // Get Pending Fees (V4 only for now)
    if (config.protocol === 'v4' && (config as V4PositionConfig).positionTokenId) {
      try {
        const fees = await getUnclaimedFees((config as V4PositionConfig).positionTokenId!, config.token0Decimals, config.token1Decimals);
        const fee0 = Number(fees.amount0Formatted);
        const fee1 = Number(fees.amount1Formatted);
        feesPendingUSD = (fee0 * token0Price) + (fee1 * token1Price);
      } catch (e) {
        // Ignore fee fetch errors
      }
    }

    // Calculate ROI / APR
    if (config.analytics?.initialValueUSD && config.analytics?.startTime) {
      const initialValue = config.analytics.initialValueUSD;
      const startTime = new Date(config.analytics.startTime).getTime();
      const now = Date.now();
      const daysElapsed = (now - startTime) / (1000 * 60 * 60 * 24);

      const totalValue = currentValueUSD + feesPendingUSD;
      roi = ((totalValue - initialValue) / initialValue) * 100;

      if (daysElapsed > 0) {
        apr = ((feesPendingUSD / initialValue) / daysElapsed) * 365 * 100;
        const dailyFee = feesPendingUSD / daysElapsed;
        if (dailyFee > 0) {
          daysToBreakeven = initialValue / dailyFee;
        }
      }
    }
  }

  return {
    config,
    currentTick,
    currentPrice,
    tickLower,
    tickUpper,
    priceLower,
    priceUpper,
    isInRange: inRange,
    deviationPercent,
    amount0,
    amount1,
    currentValueUSD,
    feesPendingUSD,
    apr,
    roi,
    daysToBreakeven
  };
}


/**
 * Format status for display/telegram
 */
export function formatPositionStatus(status: PositionStatus): string {
  const {
    config,
    currentPrice,
    priceLower,
    priceUpper,
    isInRange,
    deviationPercent,
    amount0,
    amount1,
    currentValueUSD,
    feesPendingUSD,
    apr,
    roi,
    daysToBreakeven
  } = status;

  let message = `📊 *${config.name} Status*\n`;
  message += `Protocol: ${config.protocol.toUpperCase()}\n\n`;
  message += `Current Price: \`${currentPrice.toFixed(8)}\`\n`;
  message += `Range: \`${priceLower.toFixed(8)}\` - \`${priceUpper.toFixed(8)}\`\n`;
  message += `Status: ${isInRange ? "✅ IN RANGE" : "⚠️ OUT OF RANGE"}\n`;

  if (!isInRange) {
    message += `Deviation: \`${deviationPercent.toFixed(2)}%\`\n`;
  }

  if (amount0 !== undefined && amount1 !== undefined) {
    message += `\n💰 *Holdings:*\n`;
    message += `  ${amount0.toFixed(4)} Token0\n`;
    message += `  ${amount1.toFixed(4)} Token1\n`;
    if (currentValueUSD) {
      message += `  Value: ≈$${currentValueUSD.toFixed(2)}\n`;
    }
  }

  if (feesPendingUSD && feesPendingUSD > 0) {
    message += `\n💸 *Unclaimed Fees:* ≈$${feesPendingUSD.toFixed(2)}\n`;
  }

  if (config.analytics?.initialValueUSD) {
    message += `\n📈 *Performance:*\n`;
    message += `  ROI: \`${roi?.toFixed(2)}%\`\n`;
    message += `  APR (Fees): \`${apr?.toFixed(2)}%\`\n`;
    if (daysToBreakeven && daysToBreakeven > 0) {
      message += `  Breakeven: \`${daysToBreakeven.toFixed(1)} days\`\n`;
    }
  }

  if (!isInRange) {
    message += `\n⚠️ *Action Required!*`;
  }

  return message;
}
