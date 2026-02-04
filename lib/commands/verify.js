const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

const { getOpenClawCronJobsPath } = require('../utils/checks');

async function verifyCommand(options) {
  const targetDir = path.resolve(options.dir);
  const issues = [];
  const checks = [];
  
  console.log(chalk.blue('\n🔍 Verifying context environment...\n'));
  
  // Check directory structure
  checks.push(checkDirectoryStructure(targetDir));
  
  // Check core files
  checks.push(checkCoreFiles(targetDir));
  
  // Check QMD
  checks.push(checkQmd(targetDir));
  
  // Check scripts
  checks.push(checkScripts(targetDir));

  // Check OpenClaw integration
  checks.push(checkOpenClaw());
  checks.push(checkOpenClawCron());
  
  // Run all checks
  const results = await Promise.all(checks);
  
  // Collect issues
  results.forEach(result => {
    if (!result.ok) {
      issues.push(...result.issues);
    }
  });
  
  // Report
  if (issues.length === 0) {
    console.log(chalk.green('✅ All checks passed!'));
    console.log(chalk.gray('\nContext environment is healthy.'));
  } else {
    console.log(chalk.yellow(`⚠️  Found ${issues.length} issue(s):\n`));

    for (const issue of issues) {
      console.log(chalk.yellow(`  • ${issue.message}`));
      if (issue.fixable && options.fix && typeof issue.fix === 'function') {
        process.stdout.write(chalk.gray('    Attempting fix... '));
        try {
          await issue.fix();
          console.log(chalk.green('ok'));
        } catch (e) {
          console.log(chalk.red('failed'));
          console.log(chalk.red(`      ${e.message}`));
        }
      }
    }
    
    if (!options.fix) {
      console.log(chalk.gray('\nRun with --fix to attempt automatic repairs'));
    }
  }
}

async function checkDirectoryStructure(targetDir) {
  const requiredDirs = [
    'knowledge/projects',
    'knowledge/areas/people',
    'knowledge/areas/companies',
    'knowledge/resources',
    'knowledge/archives',
    'knowledge/tacit',
    'memory',
    'scripts',
    'tasks',
    'research'
  ];
  
  const issues = [];
  
  for (const dir of requiredDirs) {
    const fullPath = path.join(targetDir, dir);
    if (!await fs.pathExists(fullPath)) {
      issues.push({
        message: `Missing directory: ${dir}`,
        fixable: true,
        fix: () => fs.ensureDir(fullPath)
      });
    }
  }
  
  return { ok: issues.length === 0, issues };
}

async function checkCoreFiles(targetDir) {
  const requiredFiles = ['MEMORY.md', 'SOUL.md', 'USER.md', 'AGENTS.md'];
  const issues = [];
  
  for (const file of requiredFiles) {
    const fullPath = path.join(targetDir, file);
    if (!await fs.pathExists(fullPath)) {
      issues.push({
        message: `Missing core file: ${file} (run: janebot-cli template ${file} -o ${path.join(targetDir, file)})`,
        fixable: false
      });
    }
  }
  
  return { ok: issues.length === 0, issues };
}

async function checkQmd(targetDir) {
  const issues = [];
  
  // Check QMD wrapper exists
  const qmdWrapper = path.join(targetDir, 'scripts', 'qmd.sh');
  if (!await fs.pathExists(qmdWrapper)) {
    issues.push({
      message: 'QMD wrapper script missing',
      fixable: true
    });
  }

  const qmdDir = path.join(targetDir, '.tools', 'qmd');
  if (!await fs.pathExists(qmdDir)) {
    issues.push({
      message: `QMD not installed (missing ${qmdDir}). Run: janebot-cli install qmd`,
      fixable: true
    });
    return { ok: issues.length === 0, issues };
  }
  
  // Check if QMD is functional (optional)
  try {
    execSync('bun run qmd --version', { cwd: qmdDir, stdio: 'ignore' });
  } catch (err) {
    issues.push({
      message: `QMD not installed or not functional (run: janebot-cli install qmd). Cause: ${err.message}`,
      fixable: true
    });
  }
  
  return { ok: issues.length === 0, issues };
}

async function checkScripts(targetDir) {
  const requiredScripts = [
    'weekly-synthesis.sh',
    'log_datetime.sh',
    'git_workspace_sweep.sh'
  ];
  
  const issues = [];
  
  for (const script of requiredScripts) {
    const fullPath = path.join(targetDir, 'scripts', script);
    if (!await fs.pathExists(fullPath)) {
      issues.push({
        message: `Missing script: ${script} (run: janebot-cli install scripts -d ${targetDir})`,
        fixable: false
      });
    }
  }
  
  return { ok: issues.length === 0, issues };
}

async function checkOpenClaw() {
  const issues = [];
  try {
    execSync('openclaw --version', { stdio: 'ignore' });
  } catch (err) {
    issues.push({
      message: `OpenClaw not found (cron + heartbeat integrations will not work). Cause: ${err.message}`,
      fixable: false
    });
  }
  return { ok: issues.length === 0, issues };
}

async function checkOpenClawCron() {
  const issues = [];
  const jobsPath = getOpenClawCronJobsPath();
  if (!jobsPath) {
    issues.push({
      message: 'HOME is not set; cannot locate ~/.openclaw/cron/jobs.json to verify OpenClaw cron.',
      fixable: false
    });
    return { ok: false, issues };
  }
  const exists = await fs.pathExists(jobsPath);
  if (!exists) {
    issues.push({
      message: `OpenClaw cron jobs.json not found: ${jobsPath} (run: janebot-cli install cron)`,
      fixable: false
    });
  }
  return { ok: issues.length === 0, issues };
}

module.exports = {
  verifyCommand,
  _test: {
    checkCoreFiles,
    checkScripts,
    checkOpenClawCron
  }
};
