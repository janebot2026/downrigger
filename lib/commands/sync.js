const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');

async function syncCommand(options) {
  const targetDir = path.resolve(options.dir);
  
  console.log(chalk.blue('\n🔄 Syncing context environment...\n'));
  
  // Update QMD indexes
  const qmdSpinner = ora('Updating QMD indexes...').start();
  try {
    const qmdWrapper = path.join(targetDir, 'scripts', 'qmd.sh');
    if (!fs.existsSync(qmdWrapper)) {
      qmdSpinner.warn('QMD wrapper not found (skipping index update)');
    } else {
      execFileSync(qmdWrapper, ['update'], {
        stdio: 'ignore',
        timeout: 60000
      });
      qmdSpinner.succeed('QMD indexes updated');
    }
  } catch (err) {
    qmdSpinner.fail(`QMD update failed: ${err.message}`);
  }
  
  // Run weekly synthesis if it's been a while
  const synthSpinner = ora('Running weekly synthesis...').start();
  try {
    const synthScript = path.join(targetDir, 'scripts', 'weekly-synthesis.sh');
    execFileSync(synthScript, [], {
      stdio: 'ignore',
      timeout: 30000
    });
    synthSpinner.succeed('Weekly synthesis complete');
  } catch (err) {
    synthSpinner.fail(`Synthesis failed: ${err.message}`);
  }
  
  // Git sync
  const gitSpinner = ora('Syncing git repositories...').start();
  try {
    const gitSweepScript = path.join(targetDir, 'scripts', 'git_workspace_sweep.sh');
    execFileSync(gitSweepScript, [], {
      stdio: 'ignore',
      timeout: 60000
    });
    gitSpinner.succeed('Git sync complete');
  } catch (err) {
    gitSpinner.fail(`Git sync failed: ${err.message}`);
  }
  
  console.log(chalk.green('\n✅ Sync complete!'));
}

module.exports = { syncCommand };
