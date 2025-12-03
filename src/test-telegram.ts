#!/usr/bin/env bun
import { sendTelegramMessage } from './telegram';

console.log('📱 Testing Telegram Notification\n');

const testMessage = `
🧪 *Test Notification*

This is a test message from your Uniswap v4 LP Monitor!

⏰ Time: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

If you can see this message, your Telegram bot is configured correctly! ✅
`.trim();

try {
  const success = await sendTelegramMessage(testMessage);
  
  if (success) {
    console.log('✅ Message sent successfully!');
    console.log('Check your Telegram to confirm you received it.\n');
  } else {
    console.log('❌ Failed to send message.');
    console.log('Please check:');
    console.log('  1. TG_BOT_TOKEN is correct in .env');
    console.log('  2. TG_CHAT_ID is correct in .env');
    console.log('  3. You have started a chat with the bot\n');
  }
} catch (error) {
  console.error('❌ Error:', error);
}
