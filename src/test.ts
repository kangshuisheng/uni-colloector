#!/usr/bin/env bun
import { checkPosition } from './pool';
import { POSITIONS } from './config';
import { printDashboard } from './ui';

console.log('🧪 Testing LP Position Monitor\n');

if (POSITIONS.length === 0) {
  console.error('❌ No positions configured in config.json');
  process.exit(1);
}

async function run() {
  try {
    const statuses = [];
    console.log('Fetching data...');
    
    for (const position of POSITIONS) {
      const status = await checkPosition(position);
      statuses.push(status);
    }
    
    printDashboard(statuses);
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

run();
