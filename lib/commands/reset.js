const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');

/**
 * Reset command - reset the trading environment
 * Usage: downrigger reset [--keep-wallet]
 * 
 * Steps:
 * 1. Stop bot-runner service
 * 2. Backup wallet if --keep-wallet
 * 3. Clear state files
 * 4. Clear journal entries (keep templates)
 * 5. Clear suggestions queue
 * 6. Reset cron job state
 * 7. Restart service (optional)
 */
async function resetCommand(options) {
  const targetDir = path.resolve(options.dir);
  const keepWallet = options.keepWallet;
  const restart = options.restart !== false; // default true
  const force = options.force;

  console.log(chalk.bold.yellow('\n🔄 Resetting Trading Environment\n'));
  console.log(chalk.gray(`Workspace: ${targetDir}`));
  console.log(chalk.gray(`Keep wallet: ${keepWallet ? 'yes' : 'no'}`));
  console.log();

  // Confirm unless --force
  if (!force) {
    console.log(chalk.yellow('⚠️  This will:'));
    console.log(chalk.gray('  - Stop bot-runner service'));
    console.log(chalk.gray('  - Clear all state files'));
    console.log(chalk.gray('  - Clear journal entries (keep templates)'));
    console.log(chalk.gray('  - Clear suggestions queue'));
    if (keepWallet) {
      console.log(chalk.gray('  - Preserve wallet file'));
    } else {
      console.log(chalk.red('  - DELETE wallet file'));
    }
    console.log();
    
    // Note: In a real CLI we'd prompt here, but for now we require --force
    console.log(chalk.red('This command requires --force to proceed.'));
    console.log(chalk.gray('Run with --force to confirm you understand the consequences.'));
    console.log();
    process.exit(1);
  }

  // Step 1: Stop bot-runner service
  const step1 = ora('Step 1/6: Stopping bot-runner service...').start();
  try {
    execSync('sudo systemctl stop bot-runner 2>/dev/null || true');
    step1.succeed('Bot-runner service stopped');
  } catch (err) {
    step1.warn('Could not stop service (may not be running)');
  }

  // Step 2: Backup wallet if requested
  let walletBackup = null;
  if (keepWallet) {
    const step2 = ora('Step 2/6: Backing up wallet...').start();
    try {
      const walletPath = path.join(targetDir, '.config', 'wallet.json');
      if (await fs.pathExists(walletPath)) {
        const backupDir = path.join(targetDir, '.backups');
        await fs.ensureDir(backupDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        walletBackup = path.join(backupDir, `wallet-${timestamp}.json`);
        await fs.copy(walletPath, walletBackup);
        step2.succeed(`Wallet backed up to ${path.relative(targetDir, walletBackup)}`);
      } else {
        step2.warn('No wallet found to backup');
      }
    } catch (err) {
      step2.fail(`Failed to backup wallet: ${err.message}`);
      throw err;
    }
  } else {
    console.log(chalk.gray('Step 2/6: Skipping wallet backup (--keep-wallet not set)'));
  }

  // Step 3: Clear state files
  const step3 = ora('Step 3/6: Clearing state files...').start();
  try {
    const stateDir = path.join(targetDir, 'state');
    if (await fs.pathExists(stateDir)) {
      const files = await fs.readdir(stateDir);
      for (const file of files) {
        await fs.remove(path.join(stateDir, file));
      }
    }
    
    // Reset config_effective.json to defaults
    await fs.writeFile(
      path.join(stateDir, 'config_effective.json'),
      JSON.stringify({
        reset_at: new Date().toISOString(),
        trading_mode: 'paper',
        strategy: null,
        risk_limits: {}
      }, null, 2)
    );
    
    step3.succeed('State files cleared');
  } catch (err) {
    step3.fail(`Failed: ${err.message}`);
  }

  // Step 4: Clear journal entries (keep templates)
  const step4 = ora('Step 4/6: Clearing journal entries...').start();
  try {
    // Clear trades (keep TEMPLATE.md)
    const tradesDir = path.join(targetDir, 'journal', 'trades');
    if (await fs.pathExists(tradesDir)) {
      const files = await fs.readdir(tradesDir);
      for (const file of files) {
        if (file !== 'TEMPLATE.md') {
          await fs.remove(path.join(tradesDir, file));
        }
      }
    }
    
    // Clear recaps (keep DAILY_TEMPLATE.md)
    const recapsDir = path.join(targetDir, 'journal', 'recaps');
    if (await fs.pathExists(recapsDir)) {
      const files = await fs.readdir(recapsDir);
      for (const file of files) {
        if (file !== 'DAILY_TEMPLATE.md') {
          await fs.remove(path.join(recapsDir, file));
        }
      }
    }
    
    // Clear decisions
    const decisionsDir = path.join(targetDir, 'journal', 'decisions');
    if (await fs.pathExists(decisionsDir)) {
      const files = await fs.readdir(decisionsDir);
      for (const file of files) {
        await fs.remove(path.join(decisionsDir, file));
      }
    }
    
    step4.succeed('Journal entries cleared (templates preserved)');
  } catch (err) {
    step4.fail(`Failed: ${err.message}`);
  }

  // Step 5: Clear suggestions queue
  const step5 = ora('Step 5/6: Clearing suggestions queue...').start();
  try {
    const pendingPath = path.join(targetDir, 'suggestions', 'pending.json');
    await fs.writeFile(pendingPath, JSON.stringify({
      version: 1,
      reset_at: new Date().toISOString(),
      description: 'Suggestion queue for human approval',
      suggestions: []
    }, null, 2));
    step5.succeed('Suggestions queue cleared');
  } catch (err) {
    step5.fail(`Failed: ${err.message}`);
  }

  // Step 6: Reset cron job state (clear last run markers)
  const step6 = ora('Step 6/6: Resetting cron state...').start();
  try {
    // Clear any .last-run markers
    const scriptsDir = path.join(targetDir, 'scripts');
    if (await fs.pathExists(scriptsDir)) {
      const files = await fs.readdir(scriptsDir);
      for (const file of files) {
        if (file.endsWith('.last-run')) {
          await fs.remove(path.join(scriptsDir, file));
        }
      }
    }
    step6.succeed('Cron state reset');
  } catch (err) {
    step6.fail(`Failed: ${err.message}`);
  }

  // Restore wallet if backed up
  if (walletBackup) {
    const step7 = ora('Restoring wallet...').start();
    try {
      const walletPath = path.join(targetDir, '.config', 'wallet.json');
      await fs.copy(walletBackup, walletPath);
      step7.succeed('Wallet restored');
    } catch (err) {
      step7.fail(`Failed to restore wallet: ${err.message}`);
    }
  }

  console.log(chalk.bold.green('\n✅ Reset complete!\n'));
  
  if (restart) {
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray('  1. Review config: cat core/TRADING_CONFIG.md'));
    console.log(chalk.gray('  2. Update risk limits: edit core/RISK_RULES.md'));
    console.log(chalk.gray('  3. Start service: sudo systemctl start bot-runner'));
    console.log(chalk.gray('  4. Verify: downrigger doctor'));
    console.log();
  }
}

module.exports = { resetCommand };
