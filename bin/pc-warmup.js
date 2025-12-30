#!/usr/bin/env node

/**
 * PC Warmup - 可执行入口
 * 全局安装后可直接使用: pc-warmup
 */

const path = require('path');
const fs = require('fs');

// 获取主程序路径
const mainScript = path.join(__dirname, '..', 'index.js');

// 检查主程序是否存在
if (!fs.existsSync(mainScript)) {
  console.error('错误: 找不到主程序 index.js');
  console.error('请确保已正确安装 pc-warmup');
  process.exit(1);
}

// 执行主程序
require(mainScript);
