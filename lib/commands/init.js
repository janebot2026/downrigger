const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');

const { setupParaStructure } = require('../utils/para');
const { installQmd } = require('../utils/qmd');
const { setupScripts } = require('../utils/scripts');
const { setupOpenClawCron } = require('../utils/openclaw-cron');
const { setupHeartbeat } = require('../utils/heartbeat');
const { setupGit } = require('../utils/git');
const { renderTemplate } = require('../utils/templates');

async function initCommand(options) {
  const targetDir = path.resolve(options.dir);
  const isDryRun = options.dryRun;

  // Safety note: OpenClaw workspaces often already exist. This init is designed to be
  // non-destructive by default (it skips existing files unless --force).
  if (!isDryRun && await isExistingClawdSetup(targetDir) && !options.force) {
    console.log(chalk.yellow('\n⚠️  Existing workspace detected (non-destructive mode)'));
    console.log(chalk.gray(`Target: ${targetDir}`));
    console.log(chalk.gray('Existing files will be preserved. Use --force to overwrite.'));
    console.log();
  }
  
  if (isDryRun) {
    console.log(chalk.bold.blue('\n🦞 DRY RUN - Previewing changes\n'));
  } else {
    console.log(chalk.bold.blue('\n🦞 Janebot Context Environment Bootstrap\n'));
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
  const dirSpinner = ora('Creating directory structure...').start();
  try {
    await fs.ensureDir(targetDir);
    await setupParaStructure(targetDir, { dryRun: false, force: options.force });
    dirSpinner.succeed('PARA structure created');
  } catch (err) {
    dirSpinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
  
  // Install QMD
  if (!options.skipQmd) {
    const qmdSpinner = ora('Installing QMD search layer...').start();
    try {
      await installQmd(targetDir, { force: options.force });
      qmdSpinner.succeed('QMD installed');
    } catch (err) {
      qmdSpinner.fail(`QMD installation failed: ${err.message}`);
      console.log(chalk.yellow('Continuing without QMD...'));
    }
  }
  
  // Setup scripts
  const scriptSpinner = ora('Setting up automation scripts...').start();
  try {
    const scripts = await setupScripts(targetDir, { 
      force: options.force, 
      agentName: options.agentName 
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
    const cronSpinner = ora('Setting up OpenClaw cron jobs...').start();
    try {
      const result = await setupOpenClawCron(targetDir, {
        agentName: options.agentName,
        force: options.force
      });
      cronSpinner.succeed(`Cron jobs configured: ${result.created.length} new, ${result.total} total`);
      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.log(chalk.yellow(`\n⚠️  ${w}`));
        }
      }
      if (result.restartRequired) {
        console.log(chalk.yellow('\n⚠️  Apply cron changes by restarting (or starting) the Gateway:'));
        console.log(chalk.gray('   openclaw gateway restart  # if already running'));
        console.log(chalk.gray('   openclaw gateway start    # if not running'));
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
  console.log(chalk.bold.green('\n✅ Context environment initialized!\n'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray(`  cd ${targetDir}`));
  console.log(chalk.gray('  openclaw cron list'));
  console.log(chalk.gray('  ./scripts/qmd.sh search "test query"'));
  console.log();
  console.log(chalk.gray('Documentation:'));
  console.log(chalk.gray('  cat MEMORY.md'));
  console.log(chalk.gray('  cat HEARTBEAT.md'));
  console.log();
  console.log(chalk.gray('Heartbeat notes:'));
  console.log(chalk.gray('  OpenClaw heartbeats read HEARTBEAT.md (if present).'));
  console.log(chalk.gray('  If your gateway heartbeat is disabled, enable it in your OpenClaw config.'));
  console.log();
}

async function previewDryRun(targetDir, options) {
  const force = Boolean(options.force);

  console.log(chalk.gray('\nWould create/update:'));

  // Directory structure
  await setupParaStructure(targetDir, { dryRun: true, force });

  // Scripts (non-destructive preview)
  const scripts = [
    'scripts/log_datetime.sh',
    'scripts/log_env_snapshot.sh',
    'scripts/log_models_and_cron.sh',
    'scripts/weekly-synthesis.sh',
    'scripts/git_workspace_sweep.sh'
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

  // QMD
  if (!options.skipQmd) {
    const qmdDir = path.join(targetDir, '.tools', 'qmd');
    console.log(`  Would install QMD into: ${qmdDir}`);
    console.log('  Would write: scripts/qmd.sh');
    console.log('  Note: requires bun + git');
  }

  // Heartbeat
  if (!options.skipHeartbeat) {
    console.log('  Would write: HEARTBEAT.md');
  }

  // Core files
  const today = new Date().toISOString().split('T')[0];
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'USER.md', 'AGENTS.md'];
  for (const name of coreFiles) {
    const p = path.join(targetDir, name);
    const exists = await fs.pathExists(p);
    if (!exists) {
      console.log(`  Would write: ${name}`);
    } else if (force) {
      console.log(`  Would overwrite: ${name}`);
    }
  }

  const memoryFile = path.join(targetDir, 'memory', `${today}.md`);
  const memoryExists = await fs.pathExists(memoryFile);
  if (!memoryExists) {
    console.log(`  Would write: memory/${today}.md`);
  } else if (force) {
    console.log(`  Would overwrite: memory/${today}.md`);
  }

  // Cron
  if (!options.skipCron) {
    console.log('  Would update: ~/.openclaw/cron/jobs.json');
    console.log('  Would write: openclaw-cron-jobs.json');
    console.log(chalk.gray('  (OpenClaw gateway restart required after changes)'));
  }

  // Git
  if (!options.skipGit) {
    console.log('  Would init git repo and create initial commit');
  }
}

async function isExistingClawdSetup(targetDir) {
  // Check for telltale signs of an existing agent workspace
  const indicators = [
    path.join(targetDir, 'MEMORY.md'),
    path.join(targetDir, 'SOUL.md'),
    path.join(targetDir, 'AGENTS.md'),
    path.join(targetDir, 'USER.md'),
    path.join(targetDir, 'HEARTBEAT.md')
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
  
  const files = [
    { name: 'MEMORY.md', template: 'MEMORY.md', data: { date: today, agentName: options.agentName || 'Jane', ownerName: options.ownerName || 'Owner' } },
    { name: 'SOUL.md', template: 'SOUL.md', data: { agentName: options.agentName || 'Jane' } },
    { name: 'USER.md', template: 'USER.md', data: { ownerName: options.ownerName || 'Owner' } },
    { name: 'AGENTS.md', template: 'AGENTS.md', data: { date: today } }
  ];
  
  for (const file of files) {
    const filePath = path.join(targetDir, file.name);
    if (await fs.pathExists(filePath) && !options.force) {
      continue; // Skip existing files unless force
    }
    const content = renderTemplate(file.template, file.data);
    await fs.writeFile(filePath, content);
  }
  
  // Create memory file
  await fs.ensureDir(path.join(targetDir, 'memory'));
  const memoryFile = path.join(targetDir, 'memory', `${today}.md`);
  if (!await fs.pathExists(memoryFile) || options.force) {
    await fs.writeFile(
      memoryFile,
      `# ${today}

[init] Context environment initialized via janebot-cli
`
    );
  }
  
  // Create state directories
  await fs.ensureDir(path.join(targetDir, '.local', 'state', 'clawdbot'));
  await fs.ensureDir(path.join(targetDir, '.cache', 'qmd'));
  
  // Create schema
  await fs.ensureDir(path.join(targetDir, 'knowledge', 'schema'));
  const schemaPath = path.join(targetDir, 'knowledge', 'schema', 'atomic-fact.json');
  if (!await fs.pathExists(schemaPath) || options.force) {
    const schema = renderTemplate('atomic-fact.json');
    await fs.writeFile(schemaPath, schema);
  }
  
  // Create owner entity
  await fs.ensureDir(path.join(targetDir, 'knowledge', 'areas', 'people', 'owner'));
  const ownerItemsPath = path.join(targetDir, 'knowledge', 'areas', 'people', 'owner', 'items.json');
  if (!await fs.pathExists(ownerItemsPath) || options.force) {
    const ownerItems = renderTemplate('owner-items.json', { date: today });
    await fs.writeFile(ownerItemsPath, ownerItems);
  }
  
  const ownerSummaryPath = path.join(targetDir, 'knowledge', 'areas', 'people', 'owner', 'summary.md');
  if (!await fs.pathExists(ownerSummaryPath) || options.force) {
    const ownerSummary = renderTemplate('owner-summary.md', { date: today });
    await fs.writeFile(ownerSummaryPath, ownerSummary);
  }
}

module.exports = { initCommand };
