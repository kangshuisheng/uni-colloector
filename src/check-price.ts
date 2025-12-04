import { createPublicClient, http, parseAbi, defineChain } from "viem";

const monad = defineChain({
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

const client = createPublicClient({
  chain: monad,
  transport: http(),
});

const POOL_ABI = parseAbi([
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
]);

const ERC20_ABI = parseAbi([
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
]);

async function main() {
  const poolAddress = "0x998B563B214f158FcE042Ca82a8D441343F507d6"; // WMON/USDC
  console.log(`Checking Price Pool: ${poolAddress}`);

  const [token0, token1, slot0] = await Promise.all([
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "token0",
    }),
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "token1",
    }),
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: "slot0",
    }),
  ]);

  const [d0, s0] = await Promise.all([
    client.readContract({
      address: token0,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: token0,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
  ]);

  const [d1, s1] = await Promise.all([
    client.readContract({
      address: token1,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: token1,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
  ]);

  console.log(`Token0: ${s0} (${d0})`);
  console.log(`Token1: ${s1} (${d1})`);

  const sqrtPriceX96 = slot0[0];
  const tick = slot0[1];
  console.log(`SqrtPriceX96: ${sqrtPriceX96}`);
  console.log(`Tick: ${tick}`);

  // Calculate Price
  // price = 1.0001^tick
  const priceRaw = Math.pow(1.0001, Number(tick));

  // Adjust for decimals
  // price = priceRaw * 10^(dec0 - dec1) ? No.
  // If we want price of Token0 in terms of Token1:
  // price0 = priceRaw * 10^(dec0 - dec1)  <-- Wait, let's verify.

  // Standard V3: price = token1 / token0
  // price = 1.0001^tick * 10^(dec0 - dec1)

  const decimalDiff = d0 - d1;
  const priceAdjusted = priceRaw * Math.pow(10, decimalDiff); // This gives price of Token0 in Token1 terms?

  // Let's check.
  // If Token0 is WMON (18) and Token1 is USDC (6).
  // Diff = 12.
  // PriceRaw is small number?

  console.log(`Price Raw (1.0001^tick): ${priceRaw}`);

  // If Token0 is WMON, we want price in USDC.
  // Price = (Amount1 / Amount0)
  // Price = 1.0001^tick / 10^(dec1 - dec0) ?

  // Correct formula for Price of Token0 in terms of Token1:
  // price = 1.0001^tick * 10^(dec0 - dec1)
  // Wait, usually it's:
  // price = 1.0001^tick / 10^(dec1 - dec0) which is same as * 10^(dec0 - dec1)

  const price0in1 = priceRaw * Math.pow(10, d0 - d1);
  console.log(`Price of ${s0} in ${s1}: ${price0in1}`);

  const price1in0 = (1 / priceRaw) * Math.pow(10, d1 - d0);
  console.log(`Price of ${s1} in ${s0}: ${price1in0}`);
}

main();
