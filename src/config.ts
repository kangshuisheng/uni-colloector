import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// Load configuration
const configFile = Bun.file('./config.json');
const config = await configFile.json();

// Define Monad chain
export const monad = defineChain({
  id: 143,
  name: 'Monad',
  network: 'monad',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || 'https://rpc.monad.xyz'] },
    public: { http: [process.env.RPC_URL || 'https://rpc.monad.xyz'] },
  },
});

// Environment variables
export const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
export const RPC_URL = process.env.RPC_URL || 'https://rpc.monad.xyz';
export const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const TG_CHAT_ID = process.env.TG_CHAT_ID;

// Validate required environment variables
if (!PRIVATE_KEY || !RPC_URL) {
  throw new Error('Missing required environment variables: PRIVATE_KEY or RPC_URL');
}

// Create account from private key
export const account = privateKeyToAccount(PRIVATE_KEY);

// Create clients
export const publicClient = createPublicClient({
  chain: monad,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: monad,
  transport: http(RPC_URL),
});

// Contract addresses on Monad
export const CONTRACTS = {
  poolManager: config.monadContracts.poolManager as Address,
  positionManager: config.monadContracts.positionManager as Address,
  stateView: config.monadContracts.stateView as Address,
  quoter: config.monadContracts.quoter as Address,
};

// Pool configuration
export const POOL_CONFIG = {
  poolId: config.poolId as `0x${string}`,
  poolKey: config.poolKey,
  position: config.position,
  monitoring: config.monitoring,
};

// Price conversion helpers
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

// Check if current tick is within position range
export function isInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
  return currentTick >= tickLower && currentTick <= tickUpper;
}
