#!/usr/bin/env bun

console.log("🔍 Calculating Correct Ticks from Price Range\n");

// From screenshot: price range is 0.01820613 - 0.03980606 MON/AUSD
const priceLower = 0.01820613;
const priceUpper = 0.03980606;

console.log("Target Price Range:");
console.log(`  Lower: ${priceLower}`);
console.log(`  Upper: ${priceUpper}\n`);

// Since MON has 6 decimals and AUSD has 18 decimals,
// we need to reverse the adjustment when calculating ticks
// tick = log(price / 10^12) / log(1.0001)

const adjustedPriceLower = priceLower / Math.pow(10, 12);
const adjustedPriceUpper = priceUpper / Math.pow(10, 12);

const tickLower = Math.floor(Math.log(adjustedPriceLower) / Math.log(1.0001));
const tickUpper = Math.floor(Math.log(adjustedPriceUpper) / Math.log(1.0001));

console.log("Calculated Ticks:");
console.log(`  tickLower: ${tickLower}`);
console.log(`  tickUpper: ${tickUpper}\n`);

// Verify by converting back
const verifyPriceLower = Math.pow(1.0001, tickLower) * Math.pow(10, 12);
const verifyPriceUpper = Math.pow(1.0001, tickUpper) * Math.pow(10, 12);

console.log("Verification (convert ticks back to prices):");
console.log(`  Lower: ${verifyPriceLower.toFixed(8)} (target: ${priceLower})`);
console.log(
  `  Upper: ${verifyPriceUpper.toFixed(8)} (target: ${priceUpper})\n`
);

// Check current status
const currentTick = -312023;
const currentPrice = 0.02822862;

console.log("Current Position:");
console.log(`  Tick: ${currentTick}`);
console.log(`  Price: ${currentPrice}\n`);

const inRange = currentTick >= tickLower && currentTick <= tickUpper;
console.log(`Is In Range?`);
console.log(`  ${tickLower} <= ${currentTick} <= ${tickUpper}`);
console.log(`  Result: ${inRange ? "✅ IN RANGE" : "❌ OUT OF RANGE"}`);

if (!inRange) {
  if (currentTick < tickLower) {
    const deviation = ((priceLower - currentPrice) / priceLower) * 100;
    console.log(`  ⬇️ Price is BELOW range by ${deviation.toFixed(2)}%`);
  } else {
    const deviation = ((currentPrice - priceUpper) / priceUpper) * 100;
    console.log(`  ⬆️ Price is ABOVE range by ${deviation.toFixed(2)}%`);
  }
}

console.log("\n✅ Update config.json with these correct tick values!");
