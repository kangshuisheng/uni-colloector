export type ProtocolVersion = "v3" | "v4";

export interface AutomationConfig {
  enabled: boolean;
  autoClaim: boolean;
  autoCompound: boolean;
  autoRebalance: boolean;
  minFeeToClaimUSD: number;
  rebalanceThresholdPercent: number;
}

export interface AnalyticsConfig {
  initialValueUSD?: number;
  startTime?: string; // ISO Date string
  token1PriceUSD?: number; // Manual override for price calculation
  token1PriceSourcePoolAddress?: `0x${string}`; // Pool to fetch Token1 price from (paired with stablecoin)
}

export interface BasePositionConfig {
  id: string; // Unique identifier for the monitor
  name: string; // Human readable name e.g. "MON/AUSD V4"
  protocol: ProtocolVersion;
  chainId: number;
  rpcUrl?: string; // Optional override
  token0Decimals: number;
  token1Decimals: number;
  tickLower: number;
  tickUpper: number;
  automation: AutomationConfig;
  analytics?: AnalyticsConfig;
}

export interface V4PositionConfig extends BasePositionConfig {
  protocol: "v4";
  poolId: `0x${string}`;
  positionTokenId: bigint;
  // V4 specific contracts if needed override
}

export interface V3PositionConfig extends BasePositionConfig {
  protocol: "v3";
  poolAddress: `0x${string}`; // V3 pools are separate contracts
  nftId: bigint; // NonfungiblePositionManager token ID
  // V3 specific contracts
  nonfungiblePositionManagerAddress: `0x${string}`;
}

export type PositionConfig = V4PositionConfig | V3PositionConfig;

export interface MonitorState {
  lastCheckTime: number;
  lastInRangeStatus: boolean | null;
  consecutiveFailures: number;
}

export interface PositionStatus {
  config: PositionConfig;
  currentTick: number;
  currentPrice: number;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  isInRange: boolean;
  deviationPercent: number;
  feesPendingUSD?: number;
  // Analytics
  amount0?: number;
  amount1?: number;
  currentValueUSD?: number;
  apr?: number;
  roi?: number;
  daysToBreakeven?: number;
}
