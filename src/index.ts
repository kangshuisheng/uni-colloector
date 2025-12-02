#!/usr/bin/env bun
import { startMonitor } from './monitor';

// 处理优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// 启动监控
console.log('🤖 Uniswap v4 LP Position Monitor');
console.log('=' .repeat(50));

startMonitor().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
