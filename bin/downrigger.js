#!/usr/bin/env node
/**
 * downrigger - Trading Agent Context Environment Bootstrap Tool
 * 
 * Sets up a full trading environment for AI agents:
 * - PARA directory structure
 * - QMD search layer
 * - Trading tools integration (claw-trader-cli)
 * - Cron jobs and automation
 * - Heartbeat monitoring
 * 
 * Usage: downrigger <command> [options]
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Load package.json from parent directory
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const { initCommand } = require('../lib/commands/init');
const { installCommand } = require('../lib/commands/install');
const { verifyCommand } = require('../lib/commands/verify');
const { doctorCommand } = require('../lib/commands/doctor');
const { templateCommand } = require('../lib/commands/template');
const tradeCommand = require('../lib/commands/trade');

function getDefaultWorkspaceDir() {
  const home = process.env.HOME || '';
  const profile = (process.env.OPENCLAW_PROFILE || '').trim();

  if (profile && profile !== 'default') {
    return path.join(home, '.openclaw', `workspace-${profile}`);
  }
  return path.join(home, '.openclaw', 'workspace');
}

program
  .name('downrigger')
  .description('Bootstrap a trading agent context environment')
  .version(pkg.version);

program
  .command('init')
  .description('Full initialization of trading context environment')
  .option('-d, --dir <path>', 'Target directory', getDefaultWorkspaceDir())
  .option('--skip-qmd', 'Skip QMD installation')
  .option('--skip-cron', 'Skip cron job setup')
  .option('--skip-git', 'Skip git initialization')
  .option('--skip-heartbeat', 'Skip heartbeat monitoring setup')
  .option('-y, --yes', 'Accept all defaults without prompting')
  .option('--dry-run', 'Preview changes without making them')
  .option('--force', 'Overwrite existing files')
  .option('--agent-name <name>', 'Agent name', 'Jane')
  .option('--owner-name <name>', 'Owner/stakeholder name', 'Owner')
  .action(initCommand);

program
  .command('install <component>')
  .description('Install specific component (pkm, qmd, scripts, cron, heartbeat, trading)')
  .option('-d, --dir <path>', 'Target directory', getDefaultWorkspaceDir())
  .option('--force', 'Overwrite existing files')
  .option('--agent-name <name>', 'Agent name', 'Jane')
  .action(installCommand);

program
  .command('verify')
  .description('Verify trading context environment integrity')
  .option('-d, --dir <path>', 'Target directory', getDefaultWorkspaceDir())
  .option('--fix', 'Attempt to fix issues automatically')
  .action(verifyCommand);

program
  .command('doctor')
  .description('Diagnose and report on environment health')
  .option('-d, --dir <path>', 'Target directory', getDefaultWorkspaceDir())
  .action(doctorCommand);

program
  .command('template <name>')
  .description('Generate a file from built-in templates')
  .option('-o, --output <path>', 'Output file path')
  .option('--list', 'List available templates')
  .action(templateCommand);

program
  .command('sync')
  .description('Sync QMD indexes and run weekly synthesis')
  .option('-d, --dir <path>', 'Target directory', getDefaultWorkspaceDir())
  .action(async (options) => {
    const { syncCommand } = require('../lib/commands/sync');
    await syncCommand(options);
  });

// Add trading command
program
  .command('trade')
  .description('Execute trades via claw-trader-cli')
  .option('-p, --price <mint>', 'Get price for a token mint')
  .option('-s, --swap <input> <output> <amount>', 'Execute a swap')
  .option('--paper', 'Use paper trading mode (default)')
  .option('--live', 'Use live trading mode (requires confirmation)')
  .option('-c, --config <path>', 'Path to trading config', '/opt/trawling-traders/.config/claw-trader')
  .action(async (options) => {
    await tradeCommand.parseAsync(['node', 'trade', ...process.argv.slice(process.argv.indexOf('trade') + 1)]);
  });

program.parse();
