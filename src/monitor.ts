import { checkPosition, formatPositionStatus } from "./pool";
import {
  sendMonitorStartAlert,
  sendOutOfRangeAlert,
  sendBackInRangeAlert,
} from "./telegram";
import { POSITIONS, MONITORING_CONFIG } from "./config";
import { getUnclaimedFees, claimFees, compoundFees } from "./automation";
import type { PositionConfig, V4PositionConfig, PositionStatus } from "./types";
import { printDashboard } from "./ui";

// State tracking per position
const positionStates = new Map<string, boolean | null>();
let isRunning = false;

/**
 * Check a single position
 */
async function checkSinglePosition(
  config: PositionConfig
): Promise<PositionStatus | null> {
  try {
    const status = await checkPosition(config);
    // console.log(formatPositionStatus(status));

    // --- Automation Logic ---
    if (config.automation.enabled) {
      const minClaimUSD = config.automation.minFeeToClaimUSD || 0;
      const pendingUSD = status.feesPendingUSD || 0;

      if (pendingUSD > minClaimUSD) {
        if (config.automation.autoCompound) {
          console.log(
            `[${config.name}] Pending Fees: $${pendingUSD.toFixed(
              2
            )} > Threshold $${minClaimUSD}. Compounding...`
          );
          await compoundFees(config);
        } else if (config.automation.autoClaim) {
          console.log(
            `[${config.name}] Pending Fees: $${pendingUSD.toFixed(
              2
            )} > Threshold $${minClaimUSD}. Claiming...`
          );
          await claimFees(config);
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
    return status;
  } catch (error) {
    console.error(`❌ Error checking ${config.name}:`, error);
    return null;
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

  const statuses: PositionStatus[] = [];
  for (const position of POSITIONS) {
    const status = await checkSinglePosition(position);
    if (status) {
      statuses.push(status);
    }
  }

  if (statuses.length > 0) {
    printDashboard(statuses);
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
