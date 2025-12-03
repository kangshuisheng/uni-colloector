# Uniswap v4 LP Position Monitor

基于 Bun.js + Viem 的 Uniswap v4 流动性头寸监控工具，支持 Telegram 实时通知。

## 功能特性

✅ **实时监控**：定期检查 LP 头寸是否在价格区间内  
✅ **Telegram 通知**：头寸出圈/入圈时自动发送告警  
✅ **支持 Monad**：运行在 Monad 链上的 Uniswap v4  
✅ **高性能**：使用 Bun.js + Viem 实现极速查询

## 快速开始

### 1. 安装依赖

确保已安装 [Bun](https://bun.sh)：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装项目依赖：

```bash
bun install
```

### 2. 配置环境变量

在 `.env` 文件中配置：

```bash
# 钱包私钥（仅用于签名，监控模式不发送交易）
PRIVATE_KEY=0xYourPrivateKey

# Monad RPC 地址
RPC_URL=https://rpc.monad.xyz

# Telegram Bot Token（从 @BotFather 获取）
TG_BOT_TOKEN=your_bot_token

# Telegram Chat ID（接收通知的聊天 ID）
TG_CHAT_ID=your_chat_id
```

#### 如何获取 Telegram 配置？

1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot` 创建新机器人
3. 获取 `TG_BOT_TOKEN`
4. 将机器人添加到你的聊天中
5. 访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` 获取 `TG_CHAT_ID`

### 3. 配置池子参数

编辑 `config.json`：

```json
{
  "poolId": "0xadaf30776f551bccdfb307c3fd8cdec198ca9a852434c8022ee32d1ccedd8219",
  "position": {
    "tickLower": -37340,
    "tickUpper": 37000,
    "priceRangeLower": 0.018206128,
    "priceRangeUpper": 0.039806058
  },
  "monitoring": {
    "checkIntervalMinutes": 5,
    "alertOnOutOfRange": true,
    "feeThresholdUSD": 5.0
  }
}
```

### 4. 测试连接

运行测试脚本验证配置：

```bash
bun run test
```

### 5. 启动监控

```bash
bun start
```

## 项目结构

```
uni-collector/
├── src/
│   ├── index.ts          # 主入口
│   ├── config.ts         # 配置和 Viem 客户端
│   ├── abis.ts           # 合约 ABI
│   ├── pool.ts           # 池状态查询
│   ├── telegram.ts       # Telegram 通知
│   ├── monitor.ts        # 监控逻辑
│   └── test.ts           # 测试脚本
├── config.json           # 池子配置
├── .env                  # 环境变量
└── package.json
```

## 监控逻辑

1. **定时查询**：每 N 分钟查询一次池的当前 tick 和价格
2. **区间判断**：判断 `tickLower <= currentTick <= tickUpper`
3. **状态变化检测**：
   - 从区间内 → 区间外：发送 ⚠️ 出圈警报
   - 从区间外 → 区间内：发送 ✅ 回归通知
4. **Telegram 通知**：实时推送状态变化

## 通知示例

### 出圈警报

```
🚨 ALERT: LP Position Out of Range!

📍 Pool: MON/AUSD (v4)
💰 Current Price: 0.04123456 MON/AUSD
📊 Your Range: 0.01820613 - 0.03980606
⚠️ Deviation: 3.59%

⏰ Time: 2025-12-02 14:30:00

💡 Recommendation:
Your position is no longer earning fees. Consider rebalancing your liquidity range.
```

## 注意事项

⚠️ **私钥安全**：

- 当前监控模式仅读取链上数据，不发送交易
- 请勿将私钥提交到代码仓库
- 生产环境建议使用只读 RPC 端点

⚠️ **配置验证**：

- 确保 `poolId` 和 `position` 参数与你的实际头寸匹配
- 价格区间需要与 tick 区间对应

⚠️ **网络稳定性**：

- RPC 端点需要稳定可用
- 建议使用私有 RPC 避免限流

## 常见问题

### Q: 如何找到我的 poolId？

A: 在 Uniswap v4 界面中查看你的 LP 头寸详情，或通过 `PositionManager` 合约查询。

### Q: 如何修改检查频率？

A: 在 `config.json` 中修改 `checkIntervalMinutes` 参数（单位：分钟）。

### Q: 不配置 Telegram 能运行吗？

A: 可以。如果未配置 TG_BOT_TOKEN，通知会在控制台输出而不发送到 Telegram。

## 路线图

- [x] 监控头寸区间状态
- [x] Telegram 实时通知
- [x] 累计手续费监控（达到阈值提醒）
- [x] 自动领取手续费并复投 (基础实现)
- [x] 自动再平衡区间 (基础实现)
- [ ] 支持多头寸监控
- [ ] Web 控制面板

## 自动化功能配置

在 `config.json` 中启用自动化功能：

```json
"automation": {
  "enabled": true,
  "autoClaim": true,
  "autoRebalance": true,
  "minFeeToClaimUSD": 5.0,
  "rebalanceThresholdPercent": 10.0
}
```

**注意**：自动化功能涉及资金操作，请确保：
1. `.env` 中的私钥有足够的 gas。
2. `config.json` 中配置了正确的 `positionTokenId`。
3. 建议先在测试网或小资金测试。

## 许可证

MIT

## 免责声明

本工具仅供学习参考，使用时请自行承担风险。DeFi 操作涉及资金风险，请谨慎使用自动化功能。
# uni-colloector
# uni-colloector
