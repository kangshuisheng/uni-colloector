import chalk from "chalk";
import Table from "cli-table3";
import type { PositionStatus } from "./types";

export function printDashboard(statuses: PositionStatus[]) {
  console.log(chalk.bold.blue("\n🦄 Uni-Collector Dashboard"));
  console.log(chalk.gray(`Last Updated: ${new Date().toLocaleTimeString()}`));
  console.log("");

  const table = new Table({
    head: [
      chalk.white("Name"),
      chalk.white("Protocol"),
      chalk.white("Range"),
      chalk.white("Price"),
      chalk.white("Status"),
      chalk.white("Value"),
      chalk.white("ROI"),
      chalk.white("APR"),
    ],
    style: {
      head: [],
      border: [],
    },
  });

  let totalValue = 0;
  let totalFees = 0;

  statuses.forEach((status) => {
    const {
      config,
      isInRange,
      currentPrice,
      priceLower,
      priceUpper,
      currentValueUSD,
      feesPendingUSD,
      roi,
      apr,
    } = status;

    // Status Icon
    const statusIcon = isInRange
      ? chalk.green("● In Range")
      : chalk.red("● Out of Range");

    // Price Formatting
    const priceStr = currentPrice.toFixed(6);

    // Range Formatting
    const rangeStr = `${priceLower.toFixed(4)} - ${priceUpper.toFixed(4)}`;

    // Value Formatting
    const valueStr =
      currentValueUSD && currentValueUSD > 0
        ? `$${currentValueUSD.toFixed(2)}`
        : chalk.gray("-");

    // ROI Formatting
    let roiStr = chalk.gray("-");
    if (config.analytics?.initialValueUSD && roi !== undefined) {
      roiStr =
        roi >= 0
          ? chalk.green(`+${roi.toFixed(2)}%`)
          : chalk.red(`${roi.toFixed(2)}%`);
    }

    // APR Formatting
    let aprStr = chalk.gray("-");
    if (config.analytics?.initialValueUSD && apr !== undefined && apr > 0) {
      aprStr = chalk.green(`${apr.toFixed(2)}%`);
    }

    table.push([
      chalk.bold(config.name),
      config.protocol.toUpperCase(),
      rangeStr,
      priceStr,
      statusIcon,
      valueStr,
      roiStr,
      aprStr,
    ]);

    totalValue += currentValueUSD || 0;
    totalFees += feesPendingUSD || 0;
  });

  console.log(table.toString());

  // Summary Box
  const summaryTable = new Table({
    chars: {
      top: "═",
      "top-mid": "╤",
      "top-left": "╔",
      "top-right": "╗",
      bottom: "═",
      "bottom-mid": "╧",
      "bottom-left": "╚",
      "bottom-right": "╝",
      left: "║",
      "left-mid": "╟",
      mid: "─",
      "mid-mid": "┼",
      right: "║",
      "right-mid": "╢",
      middle: "│",
    },
  });

  summaryTable.push(
    [
      chalk.bold("Total Value Locked"),
      chalk.bold.green(`$${totalValue.toFixed(2)}`),
    ],
    [chalk.bold("Pending Fees"), chalk.bold.yellow(`$${totalFees.toFixed(2)}`)]
  );

  console.log(summaryTable.toString());
  console.log("");
}
