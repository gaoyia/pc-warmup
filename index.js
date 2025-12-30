const os = require('os');
const cluster = require('cluster');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    cpuUsage: 70,
    warmupDuration: 300,
    checkInterval: 1000,
    useGPU: false,
    serverPort: 8080,
    autoOpenBrowser: true,
    showHelp: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--gpu' || arg === '-g') {
      config.useGPU = true;
    } else if (arg === '--cpu') {
      config.useGPU = false;
    } else if (arg === '--no-browser') {
      config.autoOpenBrowser = false;
    } else if (arg === '--help' || arg === '-h') {
      config.showHelp = true;
    } else if (arg.startsWith('--cpu=')) {
      config.cpuUsage = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--time=')) {
      config.warmupDuration = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--port=')) {
      config.serverPort = parseInt(arg.split('=')[1]);
    }
  }

  return config;
}

// 显示帮助信息
function showHelp() {
  console.log(`
========================================
       电脑预热程序 - PC Warmup
========================================

用法:
  warmup [选项]
  node index.js [选项]

选项:
  --gpu, -g        启用GPU预热（网页渲染）
  --cpu             仅使用CPU预热
  --no-browser      不自动打开浏览器
  --cpu=<值>        设置CPU使用率 (1-100)，默认70
  --time=<秒>       设置预热时长（秒），默认300（5分钟）
  --port=<端口>     设置服务器端口，默认8080
  --help, -h        显示帮助信息

示例:
  warmup --gpu              CPU+GPU预热
  warmup --cpu              仅CPU预热
  warmup --gpu --cpu=60     CPU使用率60%
  warmup --gpu --time=300   预热5分钟

全局安装:
  npm install -g .
  安装后可直接使用: warmup

停止程序:
  按 Ctrl+C 或运行: pc-stop

========================================
`);
}

// 解析命令行参数
const CONFIG = parseArgs();

// 如果显示帮助，退出
if (CONFIG.showHelp) {
  showHelp();
  process.exit(0);
}

// 工作进程数 = CPU核心数
const NUM_WORKERS = os.cpus().length;

let workers = [];
let server = null;
let browserOpened = false;
let startTime = Date.now();
let isStopping = false;

// CPU密集型任务 - 计算质数
function computePrimes(max) {
  const primes = [];
  for (let num = 2; num <= max; num++) {
    let isPrime = true;
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) {
      primes.push(num);
    }
  }
  return primes;
}

// CPU密集型任务 - 斐波那契数列
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// 控制CPU负载
function adjustCPUUsage() {
  const targetUsage = CONFIG.cpuUsage / 100;
  const cycleTime = 100; // 每个循环100ms
  const workTime = cycleTime * targetUsage;
  
  while (true) {
    const start = Date.now();
    
    // 执行密集计算
    computePrimes(10000);
    
    // 计算还需要工作多久
    const elapsed = Date.now() - start;
    
    if (elapsed >= workTime) {
      break;
    }
    
    // 继续计算直到达到目标工作时间
    while (Date.now() - start < workTime) {
      fibonacci(30);
    }
  }
  
  // 休息剩余时间
  return cycleTime - workTime;
}

// 工作进程逻辑
if (cluster.isWorker) {
  console.log(`[Worker ${process.pid}] 启动`);
  
  function runWorker() {
    while (!isStopping) {
      try {
        const restTime = adjustCPUUsage();
        
        // 检查是否应该停止
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= CONFIG.warmupDuration) {
          console.log(`[Worker ${process.pid}] 预热完成，${elapsed.toFixed(1)}秒`);
          process.exit(0);
        }
        
        // 休息
        if (restTime > 0) {
          setTimeout(runWorker, restTime);
        } else {
          runWorker();
        }
        return;
      } catch (error) {
        console.error(`[Worker ${process.pid}] 错误:`, error.message);
        setTimeout(runWorker, 1000);
      }
    }
  }
  
  runWorker();
}

// 主进程逻辑
if (cluster.isMaster) {
  console.log('========================================');
  console.log('       电脑预热程序启动中...');
  console.log('========================================');
  console.log(`CPU核心数: ${NUM_WORKERS}`);
  console.log(`目标CPU使用率: ${CONFIG.cpuUsage}%`);
  console.log(`预热时长: ${CONFIG.warmupDuration}秒 (${Math.floor(CONFIG.warmupDuration/60)}分钟)`);
  console.log(`尝试使用GPU: ${CONFIG.useGPU ? '是' : '否'}`);
  console.log('========================================\n');

  // 启动工作进程
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork();
    workers.push(worker);
    
    worker.on('exit', (code, signal) => {
      if (!isStopping) {
        console.log(`[主进程] 工作进程 ${worker.process.pid} 退出，代码: ${code}, 信号: ${signal}`);
      }
    });
  }

  // 尝试启动GPU任务（网页渲染）
  if (CONFIG.useGPU) {
    try {
      console.log('[主进程] 启动GPU预热服务器...');
      startGPUServer();
    } catch (error) {
      console.log('[主进程] 启动GPU服务器失败:', error.message);
    }
  }

  // 启动GPU渲染服务器
  function startGPUServer() {
    try {
      const htmlPath = path.join(__dirname, 'gpu_render.html');
      
      // 检查HTML文件是否存在
      if (!fs.existsSync(htmlPath)) {
        console.log('[主进程] GPU渲染页面不存在，跳过GPU任务');
        return;
      }

      server = http.createServer((req, res) => {
        if (req.url === '/' || req.url === '/gpu_render.html') {
          fs.readFile(htmlPath, 'utf8', (err, data) => {
            if (err) {
              res.writeHead(500);
              res.end('Error loading page');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
          });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(CONFIG.serverPort, () => {
        console.log(`[主进程] GPU预热服务器已启动: http://localhost:${CONFIG.serverPort}`);
        
        // 自动打开浏览器
        if (CONFIG.autoOpenBrowser) {
          const url = `http://localhost:${CONFIG.serverPort}`;
          const platform = os.platform();
          let openCommand;
          
          if (platform === 'win32') {
            openCommand = `start ${url}`;
          } else if (platform === 'darwin') {
            openCommand = `open ${url}`;
          } else {
            openCommand = `xdg-open ${url}`;
          }
          
          exec(openCommand, (error) => {
            if (error) {
              console.log('[主进程] 自动打开浏览器失败，请手动访问: ' + url);
            } else {
              console.log('[主进程] 已自动打开浏览器');
              browserOpened = true;
            }
          });
        }
      });

      server.on('error', (error) => {
        console.log('[主进程] 服务器启动失败:', error.message);
        console.log('[主进程] 可能端口被占用，跳过GPU任务');
        server = null;
      });

    } catch (error) {
      console.log('[主进程] GPU服务器启动失败:', error.message);
    }
  }

  // 监控进度
  const monitorInterval = setInterval(() => {
    if (isStopping) {
      clearInterval(monitorInterval);
      return;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, CONFIG.warmupDuration - elapsed);
    const progress = Math.min(100, (elapsed / CONFIG.warmupDuration) * 100);

    // 计算CPU负载
    const cpus = os.cpus();
    const cpuUsage = calculateCPUUsage();

    const progressBar = '█'.repeat(Math.floor(progress / 2)) + 
                       '░'.repeat(50 - Math.floor(progress / 2));

    process.stdout.write('\r' + 
      `进度: [${progressBar}] ${progress.toFixed(1)}% | ` +
      `已用: ${formatTime(elapsed)} | ` +
      `剩余: ${formatTime(remaining)} | ` +
      `CPU: ${cpuUsage}%`);

    if (elapsed >= CONFIG.warmupDuration) {
      clearInterval(monitorInterval);
      console.log('\n');
      shutdown('预热完成！');
    }
  }, CONFIG.checkInterval);

  // 计算CPU使用率
  let previousCpuTimes = null;
  function calculateCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    if (!previousCpuTimes) {
      previousCpuTimes = { totalIdle, totalTick };
      return 0;
    }

    const idleDiff = totalIdle - previousCpuTimes.totalIdle;
    const totalDiff = totalTick - previousCpuTimes.totalTick;
    const usage = 100 - Math.floor(100 * (idleDiff / totalDiff));

    previousCpuTimes = { totalIdle, totalTick };
    return Math.max(0, Math.min(100, usage));
  }

  // 格式化时间
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  }

  // 关闭程序
  function shutdown(reason) {
    if (isStopping) return;
    isStopping = true;

    console.log(`\n${reason}`);
    console.log('[主进程] 正在停止所有工作进程...');

    // 停止所有工作进程
    workers.forEach(worker => {
      worker.kill('SIGTERM');
    });

    // 停止GPU服务器
    if (server) {
      console.log('[主进程] 正在停止GPU服务器...');
      server.close(() => {
        console.log('[主进程] GPU服务器已关闭');
      });
      
      // 提示用户关闭浏览器标签页
      if (browserOpened) {
        console.log('[主进程] 请手动关闭浏览器标签页');
      }
    }

    // 优雅退出
    setTimeout(() => {
      console.log('[主进程] 已停止');
      process.exit(0);
    }, 2000);
  }

  // 优雅退出处理
  process.on('SIGINT', () => {
    shutdown('收到停止信号 (Ctrl+C)');
  });

  process.on('SIGTERM', () => {
    shutdown('收到终止信号');
  });

  process.on('uncaughtException', (error) => {
    console.error('[主进程] 未捕获的异常:', error);
    shutdown('发生错误');
  });
}
