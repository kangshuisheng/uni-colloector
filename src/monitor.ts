import { checkPosition, formatPositionStatus } from "./pool";
import {
  sendMonitorStartAlert,
  sendOutOfRangeAlert,
  sendBackInRangeAlert,
} from "./telegram";
import { POSITIONS, MONITORING_CONFIG } from "./config";
import { getUnclaimedFees, claimFees } from "./automation";
import type { PositionConfig, V4PositionConfig } from "./types";

// State tracking per position
const positionStates = new Map<string, boolean | null>();
let isRunning = false;

/**
 * Check a single position
 */
async function checkSinglePosition(config: PositionConfig): Promise<void> {
  try {
    const status = await checkPosition(config);
    console.log(formatPositionStatus(status));

    // --- Automation Logic (V4 Only for now) ---
    if (config.protocol === "v4" && config.automation.enabled) {
      const v4Config = config as V4PositionConfig;
      if (v4Config.positionTokenId) {
        // Auto Claim
        if (config.automation.autoClaim) {
          try {
            const fees = await getUnclaimedFees(
              v4Config.positionTokenId,
              config.token0Decimals,
              config.token1Decimals
            );
            if (fees.amount0 > 0n || fees.amount1 > 0n) {
              console.log(`[${config.name}] Found fees, claiming...`);
              await claimFees(v4Config.positionTokenId);
            }
          } catch (e) {
            console.error(`[${config.name}] Error claiming fees:`, e);
          }
        }
      }
    }
    // ------------------------

    // Alert Logic
    const lastStatus = positionStates.get(config.id) ?? null;

    if (lastStatus !== null && lastStatus !== status.isInRange) {
      if (!status.isInRange) {
        console.log(`⚠️ [${config.name}] moved OUT of range!`);
        await sendOutOfRangeAlert(
          status.currentPrice,
          status.priceLower,
          status.priceUpper,
          status.deviationPercent
        );
      } else {
        console.log(`✅ [${config.name}] moved BACK into range!`);
        await sendBackInRangeAlert(status.currentPrice);
      }
    } else if (lastStatus === null && !status.isInRange) {
      console.log(`⚠️ [${config.name}] Initial check: OUT of range!`);
      await sendOutOfRangeAlert(
        status.currentPrice,
        status.priceLower,
        status.priceUpper,
        status.deviationPercent
      );
    }

    positionStates.set(config.id, status.isInRange);
  } catch (error) {
    console.error(`❌ Error checking ${config.name}:`, error);
    // Don't spam error alerts for every failure, maybe track consecutive failures
  }
}

/**
 * Perform check for all positions
 */
async function performCheck(): Promise<void> {
  console.log(
    `\n[${new Date().toLocaleString("zh-CN")}] Checking ${
      POSITIONS.length
    } positions...`
  );

  for (const position of POSITIONS) {
    await checkSinglePosition(position);
  }
}

/**
 * Start Monitor
 */
export async function startMonitor(): Promise<void> {
  if (isRunning) {
    console.log("Monitor is already running");
    return;
  }

  if (POSITIONS.length === 0) {
    console.error("❌ No positions configured!");
    return;
  }

  isRunning = true;
  const checkInterval = MONITORING_CONFIG.checkIntervalMinutes;

  console.log("🚀 Starting Multi-Position Monitor...");
  console.log(`Monitoring ${POSITIONS.length} positions`);
  console.log(`Check Interval: ${checkInterval} minutes`);

  // Send start alert (using first position's ID as reference or generic)
  await sendMonitorStartAlert(POSITIONS[0].id, checkInterval);

  // Immediate check
  await performCheck();

  // Schedule
  const intervalMs = checkInterval * 60 * 1000;
  setInterval(performCheck, intervalMs);
}

export function stopMonitor(): void {
  isRunning = false;
  console.log("Monitor stopped");
}
