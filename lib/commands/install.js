const chalk = require('chalk');
const path = require('path');
const { setupParaStructure } = require('../utils/para');
const { installQmd } = require('../utils/qmd');
const { setupScripts } = require('../utils/scripts');
const { setupOpenClawCron } = require('../utils/openclaw-cron');
const { setupHeartbeat } = require('../utils/heartbeat');
const { setupDevtools } = require('../utils/devtools');
const { installTraderCommand } = require('./install-trader');

async function installCommand(component, options) {
  const targetDir = path.resolve(options.dir);
  const force = Boolean(options.force);
  const agentName = options.agentName || 'Jane';

  // Handle trader component - full trading environment setup
  if (component === 'trader') {
    return installTraderCommand(options);
  }

  // Handle "all" as a special component that installs everything
  if (component === 'all') {
    console.log(chalk.blue('Installing all components (full workspace setup)'));
    console.log(chalk.gray(`Target: ${targetDir}\n`));

    // 1. Install devtools first (Node, Rust, Python)
    console.log(chalk.cyan('Step 1/4: Installing development tools...'));
    await setupDevtools(targetDir, { force });
    console.log();

    // 2. Set up PKM structure
    console.log(chalk.cyan('Step 2/4: Setting up PKM workspace structure...'));
    await setupParaStructure(targetDir, { force });
    console.log(chalk.green('✅ PKM structure installed'));
    console.log();

    // 3. Install automation scripts
    console.log(chalk.cyan('Step 3/4: Installing automation scripts...'));
    await setupScripts(targetDir, { force, agentName });
    console.log(chalk.green('✅ Automation scripts installed'));
    console.log();

    // 4. Set up heartbeat
    console.log(chalk.cyan('Step 4/4: Configuring heartbeat monitoring...'));
    await setupHeartbeat(targetDir, { force, agentName });
    console.log(chalk.green('✅ Heartbeat configured'));
    console.log();

    console.log(chalk.green.bold('✅ Full workspace setup complete!'));
    console.log(chalk.gray(`Workspace location: ${targetDir}`));
    console.log();
    console.log(chalk.cyan('Next steps:'));
    console.log('  - Reload your shell or start a new terminal session');
    console.log('  - Verify tools: node --version && rustc --version && python --version');
    console.log(`  - Explore your workspace: cd ${targetDir}`);
    return;
  }

  console.log(chalk.blue(`Installing component: ${component}`));
  console.log(chalk.gray(`Target: ${targetDir}\n`));
  
  switch (component) {
    case 'pkm':
      await setupParaStructure(targetDir, { force });
      console.log(chalk.green('✅ PKM structure installed'));
      break;
      
    case 'qmd':
      await installQmd(targetDir, { force });
      console.log(chalk.green('✅ QMD search layer installed'));
      break;
      
    case 'scripts':
      await setupScripts(targetDir, { force, agentName });
      console.log(chalk.green('✅ Automation scripts installed'));
      break;
      
    case 'cron':
      {
        const result = await setupOpenClawCron(targetDir, { agentName, force });
        console.log(chalk.green(`✅ OpenClaw cron jobs configured (${result.created.length} new, ${result.replaced.length} replaced)`));
        if (Array.isArray(result.warnings) && result.warnings.length > 0) {
          for (const w of result.warnings) {
            console.log(chalk.yellow(`⚠️  ${w}`));
          }
        }
        if (result.restartRequired) {
          console.log(chalk.yellow('⚠️  Apply cron changes by restarting (or starting) the Gateway:'));
          console.log(chalk.gray('   openclaw gateway restart  # if already running'));
          console.log(chalk.gray('   openclaw gateway start    # if not running'));
        }
      }
      break;

    case 'heartbeat':
      await setupHeartbeat(targetDir, { force, agentName });
      console.log(chalk.green('✅ Heartbeat configured'));
      break;
      
    case 'devtools':
      await setupDevtools(targetDir, { force });
      console.log(chalk.green('✅ Development tools installation complete'));
      break;
      
    default:
      console.log(chalk.red(`Unknown component: ${component}`));
      console.log(chalk.gray('Available: all, trader, pkm, qmd, scripts, cron, heartbeat, devtools'));
      console.log(chalk.gray('  all       - Install everything (devtools + pkm + scripts + heartbeat)'));
      console.log(chalk.gray('  trader    - Install full trading environment (6 steps + green lights report)'));
      console.log(chalk.gray('  devtools  - Install Node.js, Rust, and Python'));
      console.log(chalk.gray('  pkm       - Set up PARA directory structure'));
      console.log(chalk.gray('  scripts   - Install automation scripts'));
      console.log(chalk.gray('  heartbeat - Configure heartbeat monitoring'));
      console.log(chalk.gray('  qmd       - Install QMD search layer'));
      console.log(chalk.gray('  cron      - Set up OpenClaw cron jobs'));
      process.exit(1);
  }
}

module.exports = { installCommand };
