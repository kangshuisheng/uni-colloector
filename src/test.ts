#!/usr/bin/env bun
import { checkPosition, formatPositionStatus } from './pool';
import { sendTelegramMessage } from './telegram';
import { POSITIONS } from './config';

console.log('🧪 Testing LP Position Monitor\n');

if (POSITIONS.length === 0) {
  console.error('❌ No positions configured in config.json');
  process.exit(1);
}

try {
  for (const position of POSITIONS) {
    console.log(`\n1️⃣ Testing pool state query for ${position.name}...`);
    const status = await checkPosition(position);
    
    console.log('\n📊 Position Status:');
    console.log(formatPositionStatus(status));
    
    console.log('\n2️⃣ Testing Telegram notification...');
    const message = formatPositionStatus(status);
    await sendTelegramMessage(message);
  }
  
  console.log('\n✅ All tests completed!');
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}
