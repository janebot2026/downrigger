const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

const { getOpenClawCronJobsPath } = require('../utils/checks');

async function doctorCommand(options) {
  const targetDir = path.resolve(options.dir);
  
  console.log(chalk.blue('\n🏥 Janebot Environment Health Check\n'));
  
  const checks = [
    { name: 'Node.js', check: checkNode },
    { name: 'Git', check: checkGit },
    { name: 'Bun (for QMD)', check: checkBun },
    { name: 'OpenClaw', check: checkOpenClaw },
    { name: 'OpenClaw Cron', check: checkOpenClawCron },
    { name: 'Directory Structure', check: () => checkStructure(targetDir) },
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
    return { status: 'warn', message: 'Bun not found (needed for QMD). Run: npm install -g bun' };
  }
}

function checkOpenClaw() {
  try {
    const version = execSync('openclaw --version', { encoding: 'utf8' }).trim();
    return { status: 'ok', message: version };
  } catch {
    return { status: 'warn', message: 'OpenClaw not found (cron + heartbeat integrations will not work)' };
  }
}

async function checkOpenClawCron() {
  const cronJobsPath = getOpenClawCronJobsPath();
  if (!cronJobsPath) {
    return { status: 'warn', message: 'HOME is not set; cannot locate ~/.openclaw/cron/jobs.json to check OpenClaw cron.' };
  }

  try {
    execSync('openclaw cron list', { stdio: 'ignore' });
    return { status: 'ok', message: 'openclaw cron list succeeded' };
  } catch (err) {
    if (await fs.pathExists(cronJobsPath)) {
      return { status: 'warn', message: `OpenClaw cron jobs.json exists but CLI check failed: ${cronJobsPath}. Cause: ${err.message}` };
    }
    return { status: 'warn', message: `OpenClaw cron not initialized yet (missing ${cronJobsPath}). Cause: ${err.message}` };
  }
}

async function checkStructure(targetDir) {
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
    return { status: 'warn', message: `QMD not installed (missing ${qmdDir}). Run: downrigger install qmd` };
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
  return { status: 'warn', message: `Today's memory file not found (cron may not be running)` };
}

module.exports = { doctorCommand, _test: { checkOpenClawCron } };
