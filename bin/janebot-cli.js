#!/usr/bin/env node
/**
 * janebot-cli - Context Environment Bootstrap Tool
 * 
 * Sets up a full PKM + automation environment for AI agents:
 * - PARA directory structure
 * - QMD search layer
 * - Atomic facts schema
 * - Memory decay system
 * - Cron jobs and automation
 * - Heartbeat monitoring
 * 
 * Usage: janebot-cli <command> [options]
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

function getDefaultWorkspaceDir() {
  const home = process.env.HOME || '';
  const profile = (process.env.OPENCLAW_PROFILE || '').trim();

  if (profile && profile !== 'default') {
    return path.join(home, '.openclaw', `workspace-${profile}`);
  }
  return path.join(home, '.openclaw', 'workspace');
}

program
  .name('janebot-cli')
  .description('Bootstrap a complete AI agent context environment')
  .version(pkg.version);

program
  .command('init')
  .description('Full initialization of context environment')
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
  .description('Install specific component (pkm, qmd, scripts, cron, heartbeat)')
  .option('-d, --dir <path>', 'Target directory', getDefaultWorkspaceDir())
  .option('--force', 'Overwrite existing files')
  .option('--agent-name <name>', 'Agent name', 'Jane')
  .action(installCommand);

program
  .command('verify')
  .description('Verify context environment integrity')
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

program.parse();
