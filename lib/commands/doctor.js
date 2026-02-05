const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

const { getOpenClawCronJobsPath } = require('../utils/checks');

async function doctorCommand(options) {
  const targetDir = path.resolve(options.dir);
  
  // Check if this is a trading environment
  const isTradingEnv = await fs.pathExists(path.join(targetDir, 'core', 'TRADING_CONFIG.md'));
  
  if (isTradingEnv) {
    return runTraderDoctor(targetDir);
  }
  
  // Fall back to general environment doctor
  return runGeneralDoctor(targetDir);
}

/**
 * Trading-specific doctor checks
 */
async function runTraderDoctor(targetDir) {
  console.log(chalk.bold.blue('\n🏥 Trading Environment Health Check\n'));
  console.log(chalk.gray(`Workspace: ${targetDir}\n`));
  
  const results = {
    checks: [],
    healthy: 0,
    warnings: 0,
    errors: 0
  };

  // Check 1: Control plane reachable
  results.checks.push(await checkControlPlane(targetDir));
  
  // Check 2: claw-trader can fetch prices
  results.checks.push(await checkClawTraderPrice(targetDir));
  
  // Check 3: Wallet exists and readable
  results.checks.push(await checkWallet(targetDir));
  
  // Check 4: Runner service healthy
  results.checks.push(await checkRunnerService());
  
  // Check 5: Disk space
  results.checks.push(await checkDiskSpace());
  
  // Check 6: Memory
  results.checks.push(await checkMemory());
  
  // Check 7: Time sync
  results.checks.push(await checkTimeSync());
  
  // Check 8: Trading structure
  results.checks.push(await checkTradingStructure(targetDir));
  
  // Check 9: Cron jobs configured
  results.checks.push(await checkTradingCron(targetDir));

  // Print results
  for (const check of results.checks) {
    if (check.status === 'ok') results.healthy++;
    else if (check.status === 'warn') results.warnings++;
    else results.errors++;
    
    printCheckResult(check);
  }
  
  // Summary
  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  ${results.healthy} healthy`));
  if (results.warnings > 0) console.log(chalk.yellow(`  ${results.warnings} warnings`));
  if (results.errors > 0) console.log(chalk.red(`  ${results.errors} errors`));
  
  if (results.errors === 0 && results.warnings === 0) {
    console.log(chalk.bold.green('\n🟢 All green! Trading environment is ready.'));
  } else if (results.errors === 0) {
    console.log(chalk.bold.yellow('\n🟡 Yellow lights - review warnings above.'));
  } else {
    console.log(chalk.bold.red('\n🔴 Red lights - fix errors before trading.'));
  }
  console.log();
}

async function checkControlPlane() {
  const cpUrl = process.env.CONTROL_PLANE_URL || 'https://api.trawlingtraders.com';
  try {
    execSync(`curl -sf ${cpUrl}/healthz -o /dev/null`, { timeout: 5000 });
    return { name: 'Control Plane', status: 'ok', message: `${cpUrl} reachable` };
  } catch {
    return { name: 'Control Plane', status: 'error', message: `${cpUrl} not reachable` };
  }
}

async function checkClawTraderPrice() {
  try {
    const clawTraderPath = execSync('which claw-trader', { encoding: 'utf8' }).trim();
    const output = execSync(
      `${clawTraderPath} price EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --json 2>/dev/null || echo '{"error": "failed"}'`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const parsed = JSON.parse(output);
    if (parsed.price || parsed.data) {
      return { name: 'claw-trader Price', status: 'ok', message: 'Can fetch prices' };
    }
    return { name: 'claw-trader Price', status: 'warn', message: 'Price fetch returned unexpected format' };
  } catch (err) {
    if (err.message?.includes('not found') || err.status === 127) {
      return { name: 'claw-trader Price', status: 'error', message: 'claw-trader not installed' };
    }
    return { name: 'claw-trader Price', status: 'warn', message: `Price fetch failed: ${err.message}` };
  }
}

async function checkWallet(targetDir) {
  const walletPath = path.join(targetDir, '.config', 'wallet.json');
  if (await fs.pathExists(walletPath)) {
    try {
      const walletData = await fs.readJson(walletPath);
      const addr = walletData.address || walletData.publicKey;
      if (addr) {
        return { name: 'Wallet', status: 'ok', message: `Address: ${addr.slice(0, 8)}...${addr.slice(-8)}` };
      }
      return { name: 'Wallet', status: 'warn', message: 'Wallet file exists but no address found' };
    } catch {
      return { name: 'Wallet', status: 'warn', message: 'Wallet file exists but cannot parse' };
    }
  }
  return { name: 'Wallet', status: 'warn', message: 'Wallet not created yet (will be created on first run)' };
}

async function checkRunnerService() {
  try {
    execSync('systemctl is-active --quiet bot-runner', { stdio: 'ignore' });
    return { name: 'Runner Service', status: 'ok', message: 'Active' };
  } catch {
    try {
      execSync('systemctl is-enabled --quiet bot-runner', { stdio: 'ignore' });
      return { name: 'Runner Service', status: 'warn', message: 'Enabled but not running' };
    } catch {
      return { name: 'Runner Service', status: 'warn', message: 'Not installed' };
    }
  }
}

async function checkDiskSpace() {
  try {
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const usage = parseInt(dfOutput.trim().split(/\s+/)[4].replace('%', ''));
    if (usage < 80) {
      return { name: 'Disk Space', status: 'ok', message: `${usage}% used` };
    } else if (usage < 90) {
      return { name: 'Disk Space', status: 'warn', message: `${usage}% used` };
    }
    return { name: 'Disk Space', status: 'error', message: `${usage}% used - critical` };
  } catch {
    return { name: 'Disk Space', status: 'warn', message: 'Could not check disk space' };
  }
}

async function checkMemory() {
  try {
    const memOutput = execSync('free | grep Mem', { encoding: 'utf8' });
    const parts = memOutput.trim().split(/\s+/);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    const usage = Math.round((used / total) * 100);
    if (usage < 80) {
      return { name: 'Memory', status: 'ok', message: `${usage}% used` };
    }
    return { name: 'Memory', status: 'warn', message: `${usage}% used` };
  } catch {
    return { name: 'Memory', status: 'warn', message: 'Could not check memory' };
  }
}

async function checkTimeSync() {
  try {
    const syncStatus = execSync('timedatectl show --property=NTPSynchronized --value', { encoding: 'utf8' }).trim();
    if (syncStatus === 'yes') {
      return { name: 'Time Sync', status: 'ok', message: 'NTP synchronized' };
    }
    return { name: 'Time Sync', status: 'warn', message: 'NTP not synchronized' };
  } catch {
    return { name: 'Time Sync', status: 'warn', message: 'Could not check time sync' };
  }
}

async function checkTradingStructure(targetDir) {
  const required = [
    'core/TRADING_CONFIG.md',
    'core/RISK_RULES.md',
    'core/STRATEGIES.md',
    'journal/trades',
    'journal/recaps',
    'knowledge/pinned',
    'suggestions'
  ];
  const missing = [];
  
  for (const item of required) {
    if (!await fs.pathExists(path.join(targetDir, item))) {
      missing.push(item);
    }
  }
  
  if (missing.length === 0) {
    return { name: 'Trading Structure', status: 'ok', message: 'All required directories/files present' };
  }
  return { name: 'Trading Structure', status: 'warn', message: `Missing: ${missing.join(', ')}` };
}

async function checkTradingCron(targetDir) {
  const cronJobsPath = getOpenClawCronJobsPath();
  if (!cronJobsPath) {
    return { name: 'Trading Cron', status: 'warn', message: 'Cannot locate ~/.openclaw/cron/jobs.json' };
  }

  try {
    const jobs = await fs.readJson(cronJobsPath);
    const traderJobs = (jobs.jobs || []).filter(j => j.jobId?.startsWith('trader-'));
    
    if (traderJobs.length >= 5) {
      return { name: 'Trading Cron', status: 'ok', message: `${traderJobs.length} trader jobs configured` };
    } else if (traderJobs.length > 0) {
      return { name: 'Trading Cron', status: 'warn', message: `Only ${traderJobs.length} trader jobs (expected 5)` };
    }
    return { name: 'Trading Cron', status: 'warn', message: 'No trader jobs configured' };
  } catch {
    return { name: 'Trading Cron', status: 'warn', message: 'Cannot read cron jobs file' };
  }
}

function printCheckResult(check) {
  const symbol = check.status === 'ok' ? chalk.green('✓') : 
                 check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
  const statusColor = check.status === 'ok' ? chalk.green :
                      check.status === 'warn' ? chalk.yellow : chalk.red;
  console.log(`  ${symbol} ${check.name.padEnd(20)} ${statusColor(check.message)}`);
}

/**
 * General environment doctor (original functionality)
 */
async function runGeneralDoctor(targetDir) {
  console.log(chalk.blue('\n🏥 Environment Health Check\n'));
  
  const checks = [
    { name: 'Node.js', check: checkNode },
    { name: 'Git', check: checkGit },
    { name: 'Bun (for QMD)', check: checkBun },
    { name: 'OpenClaw', check: checkOpenClaw },
    { name: 'OpenClaw Cron', check: checkOpenClawCron },
    { name: 'Directory Structure', check: () => checkGeneralStructure(targetDir) },
    { name: 'QMD Installation', check: () => checkQmdInstall(targetDir) },
    { name: 'Memory Files', check: () => checkMemoryFiles(targetDir) },
  ];
  
  let healthy = 0;
  let warnings = 0;
  let errors = 0;
  
  for (const { name, check } of checks) {
    process.stdout.write(chalk.gray(`Checking ${name}... `));
    try {
      const result = await check();
      if (result.status === 'ok') {
        console.log(chalk.green('✓'));
        healthy++;
      } else if (result.status === 'warn') {
        console.log(chalk.yellow('⚠'));
        console.log(chalk.yellow(`  ${result.message}`));
        warnings++;
      } else {
        console.log(chalk.red('✗'));
        console.log(chalk.red(`  ${result.message}`));
        errors++;
      }
    } catch (e) {
      console.log(chalk.red('✗'));
      console.log(chalk.red(`  Error: ${e.message}`));
      errors++;
    }
  }
  
  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  ${healthy} healthy`));
  if (warnings > 0) console.log(chalk.yellow(`  ${warnings} warnings`));
  if (errors > 0) console.log(chalk.red(`  ${errors} errors`));
  
  if (errors === 0 && warnings === 0) {
    console.log(chalk.bold.green('\n🦞 Environment is healthy!'));
  } else if (errors === 0) {
    console.log(chalk.bold.yellow('\n⚠️  Environment has minor issues'));
  } else {
    console.log(chalk.bold.red('\n✗ Environment needs attention'));
  }
}

// Helper functions for general doctor
function checkNode() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  if (major >= 18) {
    return { status: 'ok', message: version };
  }
  return { status: 'error', message: `Node.js 18+ required, found ${version}` };
}

function checkGit() {
  try {
    const version = execSync('git --version', { encoding: 'utf8' }).trim();
    return { status: 'ok', message: version };
  } catch {
    return { status: 'error', message: 'Git not found' };
  }
}

function checkBun() {
  try {
    const version = execSync('bun --version', { encoding: 'utf8' }).trim();
    return { status: 'ok', message: `bun ${version}` };
  } catch {
    return { status: 'warn', message: 'Bun not found (needed for QMD)' };
  }
}

function checkOpenClaw() {
  try {
    const version = execSync('openclaw --version', { encoding: 'utf8' }).trim();
    return { status: 'ok', message: version };
  } catch {
    return { status: 'warn', message: 'OpenClaw not found' };
  }
}

async function checkOpenClawCron() {
  const cronJobsPath = getOpenClawCronJobsPath();
  if (!cronJobsPath) {
    return { status: 'warn', message: 'Cannot locate ~/.openclaw/cron/jobs.json' };
  }

  try {
    execSync('openclaw cron list', { stdio: 'ignore' });
    return { status: 'ok', message: 'openclaw cron list succeeded' };
  } catch (err) {
    if (await fs.pathExists(cronJobsPath)) {
      return { status: 'warn', message: `OpenClaw cron exists but CLI check failed` };
    }
    return { status: 'warn', message: 'OpenClaw cron not initialized' };
  }
}

async function checkGeneralStructure(targetDir) {
  const required = ['knowledge', 'memory', 'scripts'];
  const missing = [];
  
  for (const dir of required) {
    if (!await fs.pathExists(path.join(targetDir, dir))) {
      missing.push(dir);
    }
  }
  
  if (missing.length === 0) {
    return { status: 'ok', message: 'All required directories present' };
  }
  return { status: 'warn', message: `Missing directories: ${missing.join(', ')}` };
}

async function checkQmdInstall(targetDir) {
  const qmdWrapper = path.join(targetDir, 'scripts', 'qmd.sh');
  if (!await fs.pathExists(qmdWrapper)) {
    return { status: 'warn', message: 'QMD wrapper not found' };
  }

  const qmdDir = path.join(targetDir, '.tools', 'qmd');
  if (!await fs.pathExists(qmdDir)) {
    return { status: 'warn', message: 'QMD not installed' };
  }
  
  try {
    execSync('bun run qmd --version', { cwd: qmdDir, stdio: 'ignore' });
    return { status: 'ok', message: 'QMD installed and functional' };
  } catch {
    return { status: 'warn', message: 'QMD wrapper exists but QMD not installed' };
  }
}

async function checkMemoryFiles(targetDir) {
  const today = new Date().toISOString().split('T')[0];
  const memoryFile = path.join(targetDir, 'memory', `${today}.md`);
  
  if (await fs.pathExists(memoryFile)) {
    return { status: 'ok', message: `Today's memory file exists` };
  }
  return { status: 'warn', message: `Today's memory file not found` };
}

module.exports = { doctorCommand, _test: { checkOpenClawCron } };
