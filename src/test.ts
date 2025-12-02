#!/usr/bin/env bun
import { checkPositionStatus, formatPositionStatus } from './pool';
import { sendTelegramMessage } from './telegram';

console.log('🧪 Testing LP Position Monitor\n');

try {
  console.log('1️⃣ Testing pool state query...');
  const status = await checkPositionStatus();
  
  console.log('\n📊 Position Status:');
  console.log(formatPositionStatus(status));
  
  console.log('\n2️⃣ Testing Telegram notification...');
  const message = formatPositionStatus(status);
  await sendTelegramMessage(message);
  
  console.log('\n✅ All tests completed!');
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}
