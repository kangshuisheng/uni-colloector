import { TG_BOT_TOKEN, TG_CHAT_ID } from './config';

export interface TelegramMessage {
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  disableNotification?: boolean;
}

/**
 * 发送 Telegram 消息
 */
export async function sendTelegramMessage(message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<boolean> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn('Telegram not configured. Skipping notification.');
    console.log('Message would be sent:', message);
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      console.error('Telegram API error:', data);
      return false;
    }

    console.log('✅ Telegram notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

/**
 * 发送出圈警报
 */
export async function sendOutOfRangeAlert(currentPrice: number, priceLower: number, priceUpper: number, deviation: number): Promise<void> {
  const message = `
🚨 *ALERT: LP Position Out of Range!*

📍 Pool: MON/AUSD (v4)
💰 Current Price: \`${currentPrice.toFixed(8)}\` MON/AUSD
📊 Your Range: \`${priceLower.toFixed(8)}\` - \`${priceUpper.toFixed(8)}\`
⚠️ Deviation: \`${deviation.toFixed(2)}%\`

⏰ Time: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

💡 *Recommendation:*
Your position is no longer earning fees. Consider rebalancing your liquidity range.
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * 发送重新进入区间的通知
 */
export async function sendBackInRangeAlert(currentPrice: number): Promise<void> {
  const message = `
✅ *LP Position Back In Range*

📍 Pool: MON/AUSD (v4)
💰 Current Price: \`${currentPrice.toFixed(8)}\` MON/AUSD

⏰ Time: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

🎉 Your position is now earning fees again!
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * 发送监控启动通知
 */
export async function sendMonitorStartAlert(poolId: string, checkInterval: number): Promise<void> {
  const message = `
🤖 *LP Monitor Started*

📍 Pool ID: \`${poolId}\`
⏱️ Check Interval: ${checkInterval} minutes

✅ Monitoring active. You'll receive alerts when:
• Position goes out of range
• Position returns to range
• Fees reach threshold (future feature)

⏰ Started: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * 发送错误警报
 */
export async function sendErrorAlert(error: string): Promise<void> {
  const message = `
❌ *Monitor Error*

Error: \`${error}\`

⏰ Time: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

Please check the logs for more details.
  `.trim();

  await sendTelegramMessage(message);
}
