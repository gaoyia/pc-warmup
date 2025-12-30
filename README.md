# 电脑预热程序 - PC Warmup

这是一个有趣的工具，用于在冬天电脑启动时通过可控的CPU和GPU负载来预热电脑，避免因低温导致的风扇机油凝固，从而产生的异常声音。

## 安装使用

### 本地运行

1. 确保已安装 Node.js (12.0 或更高版本)

2. 启动预热程序

   ```bash
   npm start
   # 或
   node index.js
   ```

3. 停止程序
   按 `Ctrl+C`

### 全局安装（推荐）

1. 在项目目录运行

   ```bash
   npm install -g pc-warmup
   ```

2. 安装后可在任何目录使用：

   ```bash
   warmup [选项]
   ```

3. 卸载：

   ```bash
   npm uninstall -g pc-warmup
   ```

## 命令行参数

### 基本用法

```bash
warmup --gpu       # CPU + GPU预热
warmup --cpu       # CPU预热（默认）
warmup --help      # 显示帮助
```

### 完整选项

| 参数 | 说明 | 默认值 |
| ------ | ------ | -------- |
| `--gpu`, `-g` | 启用GPU预热（网页渲染） | false |
| `--cpu` | 使用CPU预热（默认） | - |
| `--no-browser` | 不自动打开浏览器 | - |
| `--time=<秒>` | 设置预热时长（秒） | 600 |
| `--port=<端口>` | 设置服务器端口 | 8080 |
| `--help`, `-h` | 显示帮助信息 | - |

### 使用示例

```bash
warmup                    # CPU预热 仅cpu预热
warmup --gpu              # CPU+GPU预热（自动打开网页）
warmup --time=300   # 预热5分钟
warmup --gpu --no-browser # 启动网页服务但，不自动打开浏览器
```

## 配置说明

### 方式1: 命令行参数（推荐）

```bash
warmup --cpu=80 --time=600
```

### 方式2: 编辑 `config.json` 文件

```json
{
  "cpuUsage": 70,           // 目标CPU使用率 (1-100)
  "warmupDuration": 600,     // 预热时长（秒）
  "checkInterval": 1000,     // 检查间隔（毫秒）
  "useGPU": true,           // 是否使用GPU预热
  "serverPort": 8080,        // 本地服务器端口
  "autoOpenBrowser": true    // 自动打开浏览器
}
```

**注意**: 使用命令行参数 `--gpu` 会覆盖 `useGPU` 配置

**建议值**:

- `cpuUsage`: 60-80，太高可能导致系统响应变慢
- `warmupDuration`: 300-900秒（5-15分钟），根据环境温度调整
- `checkInterval`: 500-2000，越小越平滑但CPU占用略高

## GPU使用说明

GPU预热使用网页渲染方式，无需安装额外依赖：

1. 程序会自动启动一个本地HTTP服务器
2. 自动打开浏览器访问GPU预热页面
3. 页面使用Canvas进行GPU加速渲染
4. 可以通过页面按钮调整GPU负载

**注意**:

- 使用浏览器内置的Canvas/WebGL进行GPU加速
- 可以手动调整粒子数量来控制GPU负载

## 功能特点

- ✅ 自动检测CPU核心数，充分利用多核性能
- ✅ 可控的CPU使用率，避免系统卡顿
- ✅ 实时显示预热进度和CPU使用率
- ✅ 支持GPU预热（网页渲染，无需额外依赖）
- ✅ 优雅的停止机制
- ✅ 进度条可视化
- ✅ 自动打开浏览器
- ✅ GPU预热页面可实时监控和调整
- ✅ 支持全局安装，随处可用
- ✅ 灵活的命令行参数配置

## 工作原理

### CPU预热

- 启动多个工作进程（等于CPU核心数）
- 每个进程交替执行密集计算和休息
- 通过调整工作和休息时间比例控制CPU使用率

### GPU预热

- 使用Canvas/WebGL进行网页渲染
- 大量粒子运动和连线产生GPU负载
- 可在网页中实时调整粒子数量
- 轻量级，无需额外依赖

## 技术栈

- Node.js (主程序和工作进程管理)
- HTML5 Canvas (GPU加速渲染)
- 浏览器原生API (无额外依赖)

## 安全说明

- 可随时通过 `Ctrl+C` 停止


## 开源协议

MIT License - 自由使用和修改

---

### 祝使用愉快！电脑不再"感冒" 🌡️
