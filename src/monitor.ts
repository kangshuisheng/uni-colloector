import { checkPositionStatus, formatPositionStatus } from './pool';
import {
  sendMonitorStartAlert,
  sendOutOfRangeAlert,
  sendBackInRangeAlert,
  sendErrorAlert,
} from './telegram';
import { POOL_CONFIG } from './config';

// 状态跟踪
let lastInRangeStatus: boolean | null = null;
let isRunning = false;

/**
 * 执行单次检查
 */
async function performCheck(): Promise<void> {
  try {
    console.log(`\n[${new Date().toLocaleString('zh-CN')}] Checking position status...`);

    const status = await checkPositionStatus();

    // 打印当前状态
    console.log(formatPositionStatus(status));

    // 检测状态变化
    if (lastInRangeStatus !== null && lastInRangeStatus !== status.isInRange) {
      // 状态发生变化
      if (!status.isInRange) {
        // 从区间内变为区间外
        console.log('⚠️ Position moved OUT of range! Sending alert...');
        await sendOutOfRangeAlert(
          status.currentPrice,
          status.priceLower,
          status.priceUpper,
          status.deviationPercent
        );
      } else {
        // 从区间外变为区间内
        console.log('✅ Position moved BACK into range! Sending alert...');
        await sendBackInRangeAlert(status.currentPrice);
      }
    } else if (lastInRangeStatus === null && !status.isInRange) {
      // 首次检查就发现在区间外
      console.log('⚠️ Initial check: Position is OUT of range! Sending alert...');
      await sendOutOfRangeAlert(
        status.currentPrice,
        status.priceLower,
        status.priceUpper,
        status.deviationPercent
      );
    }

    // 更新状态
    lastInRangeStatus = status.isInRange;
  } catch (error) {
    console.error('❌ Error during check:', error);
    await sendErrorAlert(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 启动监控
 */
export async function startMonitor(): Promise<void> {
  if (isRunning) {
    console.log('Monitor is already running');
    return;
  }

  isRunning = true;
  const checkInterval = POOL_CONFIG.monitoring.checkIntervalMinutes;

  console.log('🚀 Starting LP Position Monitor...');
  console.log(`Pool ID: ${POOL_CONFIG.poolId}`);
  console.log(`Check Interval: ${checkInterval} minutes`);
  console.log(`Price Range: ${POOL_CONFIG.position.priceRangeLower} - ${POOL_CONFIG.position.priceRangeUpper}`);

  // 发送启动通知
  await sendMonitorStartAlert(POOL_CONFIG.poolId, checkInterval);

  // 立即执行一次检查
  await performCheck();

  // 设置定时检查
  const intervalMs = checkInterval * 60 * 1000;
  setInterval(performCheck, intervalMs);

  console.log(`\n✅ Monitor started. Checking every ${checkInterval} minutes...`);
}

/**
 * 停止监控
 */
export function stopMonitor(): void {
  isRunning = false;
  console.log('Monitor stopped');
}
