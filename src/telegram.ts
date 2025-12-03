import { TG_BOT_TOKEN, TG_CHAT_ID } from "./config";

export interface TelegramMessage {
  text: string;
  parseMode?: "Markdown" | "HTML";
  disableNotification?: boolean;
}

/**
 * 发送 Telegram 消息
 */
export async function sendTelegramMessage(
  message: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<boolean> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn("Telegram not configured. Skipping notification.");
    console.log("Message would be sent:", message);
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Telegram API error:", data);
      return false;
    }

    console.log("✅ Telegram notification sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

/**
 * 发送出圈警报
 */
export async function sendOutOfRangeAlert(
  positionName: string,
  currentPrice: number,
  priceLower: number,
  priceUpper: number,
  deviation: number
): Promise<void> {
  const message = `
🚨 *警报: LP 仓位超出区间!*

📍 仓位: \`${positionName}\`
💰 当前价格: \`${currentPrice.toFixed(8)}\`
📊 设定区间: \`${priceLower.toFixed(8)}\` - \`${priceUpper.toFixed(8)}\`
⚠️ 偏离程度: \`${deviation.toFixed(2)}%\`

⏰ 时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

💡 *建议:*
您的仓位目前不再赚取手续费。请考虑重新平衡您的流动性区间。
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * 发送重新进入区间的通知
 */
export async function sendBackInRangeAlert(
  positionName: string,
  currentPrice: number
): Promise<void> {
  const message = `
✅ *LP 仓位回到区间*

📍 仓位: \`${positionName}\`
💰 当前价格: \`${currentPrice.toFixed(8)}\`

⏰ 时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

🎉 您的仓位现在恢复赚取手续费了！
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * 发送监控启动通知
 */
export async function sendMonitorStartAlert(
  positionCount: number,
  checkInterval: number
): Promise<void> {
  const message = `
🤖 *LP 监控已启动*

📊 监控仓位数量: \`${positionCount}\`
⏱️ 检查间隔: ${checkInterval} 分钟

✅ 监控激活中。当发生以下情况时您将收到通知：
• 仓位超出区间
• 仓位回到区间
• 自动复利/领取执行

⏰ 启动时间: ${new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  })}
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * 发送自动操作通知 (复利/领取)
 */
export async function sendAutoActionAlert(
  action: "复利" | "领取",
  positionName: string,
  amount0: string,
  symbol0: string, // e.g. "MON"
  amount1: string,
  symbol1: string, // e.g. "AUSD"
  txHash?: string
): Promise<void> {
  const emoji = action === "复利" ? "🔄" : "💰";

  let message = `
${emoji} *自动${action}执行成功*

📍 仓位: \`${positionName}\`
💵 ${action}金额:
• ${amount0} ${symbol0}
• ${amount1} ${symbol1}

⏰ 时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
`.trim();

  if (txHash) {
    // 简单的截断显示
    const shortHash = `${txHash.substring(0, 6)}...${txHash.substring(
      txHash.length - 4
    )}`;
    message += `\n🔗 交易哈希: \`${shortHash}\``;
  }

  await sendTelegramMessage(message);
}

/**
 * 发送错误警报
 */
export async function sendErrorAlert(error: string): Promise<void> {
  const message = `
❌ *监控错误*

错误信息: \`${error}\`

⏰ 时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

请检查日志以获取更多详细信息。
  `.trim();

  await sendTelegramMessage(message);
}
