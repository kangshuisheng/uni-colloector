import { publicClient, CONTRACTS, POOL_CONFIG, isInRange } from "./config";
import { STATE_VIEW_ABI } from "./abis";

export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
  price: number;
  liquidity: bigint;
}

export interface PositionStatus {
  currentTick: number;
  currentPrice: number;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  isInRange: boolean;
  deviationPercent: number;
}

/**
 * 获取池的当前状态
 */
export async function getPoolState(): Promise<PoolState> {
  try {
    // 使用 StateView 合约获取 slot0
    const slot0 = await publicClient.readContract({
      address: CONTRACTS.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getSlot0",
      args: [POOL_CONFIG.poolId],
    });

    const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0;

    // 获取流动性
    const liquidity = await publicClient.readContract({
      address: CONTRACTS.stateView,
      abi: STATE_VIEW_ABI,
      functionName: "getLiquidity",
      args: [POOL_CONFIG.poolId],
    });

    // 从 tick 计算价格
    const tickNum = Number(tick);
    const rawPrice = Math.pow(1.0001, tickNum);

    // MON has 6 decimals, AUSD has 18 decimals
    // Adjust price: price * 10^(decimal1 - decimal0) = price * 10^(18-6) = price * 10^12
    const price = rawPrice * Math.pow(10, 12);

    return {
      sqrtPriceX96,
      tick: tickNum,
      protocolFee: Number(protocolFee),
      lpFee: Number(lpFee),
      price,
      liquidity,
    };
  } catch (error) {
    console.error("Error fetching pool state:", error);
    throw error;
  }
}

/**
 * 检查头寸是否在区间内
 */
export async function checkPositionStatus(): Promise<PositionStatus> {
  const poolState = await getPoolState();
  const { tick: currentTick, price: currentPrice } = poolState;
  const { tickLower, tickUpper, priceRangeLower, priceRangeUpper } =
    POOL_CONFIG.position;

  const inRange = isInRange(currentTick, tickLower, tickUpper);

  // 计算偏离百分比
  let deviationPercent = 0;
  if (!inRange) {
    if (currentTick < tickLower) {
      // 价格低于范围
      deviationPercent =
        ((priceRangeLower - currentPrice) / priceRangeLower) * 100;
    } else {
      // 价格高于范围
      deviationPercent =
        ((currentPrice - priceRangeUpper) / priceRangeUpper) * 100;
    }
  }

  return {
    currentTick,
    currentPrice,
    tickLower,
    tickUpper,
    priceLower: priceRangeLower,
    priceUpper: priceRangeUpper,
    isInRange: inRange,
    deviationPercent,
  };
}

/**
 * 格式化头寸状态为可读文本
 */
export function formatPositionStatus(status: PositionStatus): string {
  const { currentPrice, priceLower, priceUpper, isInRange, deviationPercent } =
    status;

  let message = `📊 *LP Position Status*\n\n`;
  message += `Current Price: \`${currentPrice.toFixed(8)}\` MON/AUSD\n`;
  message += `Price Range: \`${priceLower.toFixed(
    8
  )}\` - \`${priceUpper.toFixed(8)}\`\n`;
  message += `Status: ${isInRange ? "✅ IN RANGE" : "⚠️ OUT OF RANGE"}\n`;

  if (!isInRange) {
    message += `Deviation: \`${deviationPercent.toFixed(2)}%\`\n`;
    message += `\n⚠️ *Action Required: Position is out of range!*`;
  }

  return message;
}
