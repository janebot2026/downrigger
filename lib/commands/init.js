const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');

const { setupTraderStructure } = require('../utils/trader-structure');
const { setupTraderScripts } = require('../utils/trader-scripts');
const { setupTraderCron } = require('../utils/trader-cron');
const { setupHeartbeat } = require('../utils/heartbeat');
const { setupGit } = require('../utils/git');
const { renderTemplate } = require('../utils/templates');

async function initCommand(options) {
  const targetDir = path.resolve(options.dir);
  const isDryRun = options.dryRun;

  if (!isDryRun && await isExistingTraderSetup(targetDir) && !options.force) {
    console.log(chalk.yellow('\n⚠️  Existing trader workspace detected (non-destructive mode)'));
    console.log(chalk.gray(`Target: ${targetDir}`));
    console.log(chalk.gray('Existing files will be preserved. Use --force to overwrite.'));
    console.log();
  }
  
  if (isDryRun) {
    console.log(chalk.bold.blue('\n🦞 DRY RUN - Previewing changes\n'));
  } else {
    console.log(chalk.bold.blue('\n🦞 Trading Agent Context Bootstrap\n'));
    console.log(chalk.gray('Always-on trader that can explain itself\n'));
  }
  console.log(chalk.gray(`Target: ${targetDir}`));
  if (isDryRun) {
    console.log(chalk.yellow('Mode: Dry run (no changes will be made)\n'));
  } else {
    console.log();
  }
  
  // Check prerequisites
  const spinner = ora('Checking prerequisites...').start();
  const prereqs = checkPrerequisites();
  if (!prereqs.ok) {
    spinner.fail('Prerequisites check failed');
    console.log(chalk.red(prereqs.errors.join('\n')));
    process.exit(1);
  }
  spinner.succeed('Prerequisites OK');
  
  if (isDryRun) {
    await previewDryRun(targetDir, options);
    console.log(chalk.bold.yellow('\n🛑 Dry run complete - no changes made'));
    console.log(chalk.gray('\nTo execute, run without --dry-run'));
    return;
  }
  
  // Execute
  console.log(chalk.gray('\nExecuting...\n'));
  
  // Create directory structure
  const dirSpinner = ora('Creating trader directory structure...').start();
  try {
    await fs.ensureDir(targetDir);
    await setupTraderStructure(targetDir, { dryRun: false, force: options.force });
    dirSpinner.succeed('Trader structure created');
  } catch (err) {
    dirSpinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
  
  // Setup scripts
  const scriptSpinner = ora('Setting up trading scripts...').start();
  try {
    const scripts = await setupTraderScripts(targetDir, { 
      force: options.force
    });
    scriptSpinner.succeed(`Scripts installed: ${scripts.join(', ')}`);
  } catch (err) {
    scriptSpinner.fail(`Script setup failed: ${err.message}`);
  }
  
  // Setup heartbeat monitoring
  if (!options.skipHeartbeat) {
    const heartbeatSpinner = ora('Setting up heartbeat monitoring...').start();
    try {
      const heartbeatFiles = await setupHeartbeat(targetDir, {
        force: options.force,
        agentName: options.agentName
      });
      heartbeatSpinner.succeed(`Heartbeat configured: ${heartbeatFiles.join(', ')}`);
    } catch (err) {
      heartbeatSpinner.fail(`Heartbeat setup failed: ${err.message}`);
    }
  }
  
  // Setup initial files
  const fileSpinner = ora('Creating initial files...').start();
  try {
    await createInitialFiles(targetDir, options);
    fileSpinner.succeed('Initial files created');
  } catch (err) {
    fileSpinner.fail(`File creation failed: ${err.message}`);
  }
  
  // Setup OpenClaw cron jobs
  if (!options.skipCron) {
    const cronSpinner = ora('Setting up trading cron jobs...').start();
    try {
      const result = await setupTraderCron(targetDir, {
        agentName: options.agentName,
        force: options.force
      });
      cronSpinner.succeed(`Cron jobs configured: ${result.created.length} new, ${result.total} total`);
      if (result.restartRequired) {
        console.log(chalk.yellow('\n⚠️  Apply cron changes by restarting the Gateway:'));
        console.log(chalk.gray('   openclaw gateway restart'));
      }
    } catch (err) {
      cronSpinner.fail(`Cron setup failed: ${err.message}`);
      console.log(chalk.yellow('You may need to manually configure cron jobs'));
    }
  }
  
  // Initialize git
  if (!options.skipGit) {
    const gitSpinner = ora('Initializing git repository...').start();
    try {
      await setupGit(targetDir);
      gitSpinner.succeed('Git repository initialized');
    } catch (err) {
      gitSpinner.fail(`Git init failed: ${err.message}`);
    }
  }
  
  // Final summary
  console.log(chalk.bold.green('\n✅ Trading agent context initialized!\n'));
  console.log(chalk.white('This trader can answer:'));
  console.log(chalk.gray('  • What it is doing now'));
  console.log(chalk.gray('  • What it changed recently'));
  console.log(chalk.gray('  • What it learned from trades'));
  console.log(chalk.gray('  • What it recommends next\n'));
  console.log(chalk.white('Learning loops:'));
  console.log(chalk.gray('  Daily recap → journal/recaps/YYYY-MM-DD.md'));
  console.log(chalk.gray('  Weekly synthesis → journal/recaps/WEEK-YYYY-WW.md'));
  console.log(chalk.gray('  Suggestions → suggestions/pending.json (human-approved)\n'));
  console.log(chalk.white('Core files:'));
  console.log(chalk.gray('  core/SOUL.md          # Trader persona'));
  console.log(chalk.gray('  core/USER.md          # Owner goals + risk tolerance'));
  console.log(chalk.gray('  core/AGENTS.md        # How the trader operates'));
  console.log(chalk.gray('  core/HEARTBEAT.md     # What to report upstream'));
  console.log(chalk.gray('  core/TRADING_CONFIG.md # Settings + safe defaults'));
  console.log(chalk.gray('  core/RISK_RULES.md    # Hard rails (always enforced)'));
  console.log(chalk.gray('  core/STRATEGIES.md    # 3 modes + strictness + knobs'));
  console.log(chalk.gray('  knowledge/pinned/CONSTITUTION.md # Always remember\n'));
  console.log(chalk.gray('Next steps:'));
  console.log(chalk.gray(`  cd ${targetDir}`));
  console.log(chalk.gray('  cat core/CONSTITUTION.md'));
  console.log(chalk.gray('  cat core/RISK_RULES.md'));
  console.log(chalk.gray('  openclaw cron list'));
  console.log();
}

async function previewDryRun(targetDir, options) {
  const force = Boolean(options.force);

  console.log(chalk.gray('\nWould create/update:'));

  // Directory structure
  await setupTraderStructure(targetDir, { dryRun: true, force });

  // Scripts
  const scripts = [
    'scripts/health_check.sh',
    'scripts/report_wallet.sh',
    'scripts/restart_runner.sh',
    'scripts/reconcile_now.sh',
    'scripts/daily_recap.sh',
    'scripts/weekly_synthesis.sh'
  ];
  for (const rel of scripts) {
    const abs = path.join(targetDir, rel);
    const exists = await fs.pathExists(abs);
    if (!exists) {
      console.log(`  Would write: ${rel}`);
    } else if (force) {
      console.log(`  Would overwrite: ${rel}`);
    }
  }

  // Heartbeat
  if (!options.skipHeartbeat) {
    console.log('  Would write: core/HEARTBEAT.md');
  }

  // Core files
  const coreFiles = [
    'core/MEMORY.md',
    'core/SOUL.md', 
    'core/USER.md',
    'core/AGENTS.md',
    'core/TRADING_CONFIG.md',
    'core/RISK_RULES.md',
    'core/STRATEGIES.md'
  ];
  for (const name of coreFiles) {
    const p = path.join(targetDir, name);
    const exists = await fs.pathExists(p);
    if (!exists) {
      console.log(`  Would write: ${name}`);
    } else if (force) {
      console.log(`  Would overwrite: ${name}`);
    }
  }

  // Knowledge/pinned
  console.log('  Would write: knowledge/pinned/CONSTITUTION.md');

  // Templates
  console.log('  Would write: journal/trades/TEMPLATE.md');
  console.log('  Would write: journal/recaps/DAILY_TEMPLATE.md');
  console.log('  Would write: reports/incidents/TEMPLATE.md');

  // Suggestions queue
  console.log('  Would write: suggestions/pending.json');

  // Cron
  if (!options.skipCron) {
    console.log('  Would update: ~/.openclaw/cron/jobs.json');
    console.log(chalk.gray('  (OpenClaw gateway restart required after changes)'));
  }

  // Git
  if (!options.skipGit) {
    console.log('  Would init git repo and create initial commit');
  }
}

async function isExistingTraderSetup(targetDir) {
  const indicators = [
    path.join(targetDir, 'core', 'MEMORY.md'),
    path.join(targetDir, 'core', 'SOUL.md'),
    path.join(targetDir, 'core', 'TRADING_CONFIG.md'),
    path.join(targetDir, 'journal', 'trades')
  ];
  
  for (const indicator of indicators) {
    if (await fs.pathExists(indicator)) {
      return true;
    }
  }
  return false;
}

function checkPrerequisites() {
  const errors = [];
  
  try {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (major < 18) {
      errors.push(`Node.js 18+ required, found ${nodeVersion}`);
    }
  } catch {
    errors.push('Node.js not found');
  }
  
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    errors.push('Git not found');
  }
  
  return { ok: errors.length === 0, errors };
}

async function createInitialFiles(targetDir, options) {
  const today = new Date().toISOString().split('T')[0];
  
  // Core files (identity + trading brain clarity)
  const coreFiles = [
    { name: 'core/MEMORY.md', template: 'MEMORY.md', data: { date: today, agentName: options.agentName || 'Jane', ownerName: options.ownerName || 'Owner' } },
    { name: 'core/SOUL.md', template: 'SOUL.md', data: { agentName: options.agentName || 'Jane' } },
    { name: 'core/USER.md', template: 'USER.md', data: { ownerName: options.ownerName || 'Owner' } },
    { name: 'core/AGENTS.md', template: 'AGENTS.md', data: { date: today } },
    { name: 'core/TRADING_CONFIG.md', template: 'TRADING_CONFIG.md', data: { date: today, agentName: options.agentName || 'Jane' } },
    { name: 'core/RISK_RULES.md', template: 'RISK_RULES.md', data: { date: today } },
    { name: 'core/STRATEGIES.md', template: 'STRATEGIES.md', data: { date: today } }
  ];
  
  for (const file of coreFiles) {
    const filePath = path.join(targetDir, file.name);
    if (await fs.pathExists(filePath) && !options.force) {
      continue;
    }
    const content = renderTemplate(file.template, file.data);
    await fs.writeFile(filePath, content);
  }

  // Constitution in knowledge/pinned
  await fs.ensureDir(path.join(targetDir, 'knowledge', 'pinned'));
  const constitutionPath = path.join(targetDir, 'knowledge', 'pinned', 'CONSTITUTION.md');
  if (!await fs.pathExists(constitutionPath) || options.force) {
    const constitutionContent = renderTemplate('CONSTITUTION.md', { date: today });
    await fs.writeFile(constitutionPath, constitutionContent);
  }
  
  // Templates for journal and reports
  const templates = [
    { dir: 'journal/trades', name: 'TEMPLATE.md', template: 'TRADE_TEMPLATE.md' },
    { dir: 'journal/recaps', name: 'DAILY_TEMPLATE.md', template: 'DAILY_TEMPLATE.md' },
    { dir: 'reports/incidents', name: 'TEMPLATE.md', template: 'INCIDENT_TEMPLATE.md' }
  ];
  
  for (const tmpl of templates) {
    await fs.ensureDir(path.join(targetDir, tmpl.dir));
    const filePath = path.join(targetDir, tmpl.dir, tmpl.name);
    if (!await fs.pathExists(filePath) || options.force) {
      const content = renderTemplate(tmpl.template, {});
      await fs.writeFile(filePath, content);
    }
  }

  // Suggestions queue (human-approved)
  await fs.ensureDir(path.join(targetDir, 'suggestions'));
  const pendingPath = path.join(targetDir, 'suggestions', 'pending.json');
  if (!await fs.pathExists(pendingPath) || options.force) {
    await fs.writeFile(pendingPath, JSON.stringify({
      version: 1,
      lastUpdated: today,
      description: 'Suggestion queue for human approval. Bot writes suggestions here, human approves in app, control plane creates ConfigVersion.',
      suggestions: []
    }, null, 2));
  }
  
  // Create initial trade journal entry
  const tradeJournal = path.join(targetDir, 'journal', 'trades', `${today}.md`);
  if (!await fs.pathExists(tradeJournal) || options.force) {
    await fs.writeFile(
      tradeJournal,
      `# Trade Journal: ${today}

## Trades Executed

## Decisions Made

## Market Conditions

## Risk Events

---
*Auto-generated by downrigger*
`
    );
  }
  
  // Create state files
  await fs.ensureDir(path.join(targetDir, 'state'));
  
  const healthPath = path.join(targetDir, 'state', 'health.json');
  if (!await fs.pathExists(healthPath) || options.force) {
    await fs.writeFile(healthPath, JSON.stringify({
      last_check: new Date().toISOString(),
      runner_pid: null,
      claw_trader_available: false
    }, null, 2));
  }
  
  const configPath = path.join(targetDir, 'state', 'config_effective.json');
  if (!await fs.pathExists(configPath) || options.force) {
    await fs.writeFile(configPath, JSON.stringify({
      initialized_at: new Date().toISOString(),
      trading_mode: 'paper',
      strategy: null,
      risk_limits: {}
    }, null, 2));
  }
  
  const portfolioPath = path.join(targetDir, 'state', 'portfolio_snapshot.json');
  if (!await fs.pathExists(portfolioPath) || options.force) {
    await fs.writeFile(portfolioPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      cash: 0,
      positions: [],
      total_value: 0
    }, null, 2));
  }
  
  // Create initial recap
  const recapPath = path.join(targetDir, 'journal', 'recaps', `${today}.md`);
  if (!await fs.pathExists(recapPath) || options.force) {
    await fs.writeFile(
      recapPath,
      `# Daily Recap: ${today}

## What Happened Today
- Initialized trading agent context
- Set up monitoring and health checks

## What Worked / What Didn't
- ✅ Structure created successfully

## Top 3 Learnings
1. Context initialized with safety-first defaults
2. All risk rules are hard-enforced
3. Paper trading is default until explicitly changed

## Suggested Tweaks
1. Configure specific risk limits in core/RISK_RULES.md
2. Select strategy in core/TRADING_CONFIG.md
3. Review CONSTITUTION.md before going live

## Stats
- PnL: N/A (first day)
- Trade count: 0
- Win rate: N/A

---
*Initialize by downrigger*
`
    );
  }
}

module.exports = { initCommand };
