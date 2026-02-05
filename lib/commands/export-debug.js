const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');

/**
 * Export debug bundle for support
 * Usage: downrigger export-debug [--last 24h]
 * 
 * Collects:
 * - Log tails
 * - Last configs
 * - Recent incidents
 * - Portfolio snapshots
 * - Last 200 events
 */
async function exportDebugCommand(options) {
  const targetDir = path.resolve(options.dir);
  const hours = options.last || 24;
  const outputFile = options.output || `debug-bundle-${new Date().toISOString().split('T')[0]}.tar.gz`;

  console.log(chalk.bold.blue('\n📦 Creating Debug Export Bundle\n'));
  console.log(chalk.gray(`Workspace: ${targetDir}`));
  console.log(chalk.gray(`Time range: Last ${hours} hours`));
  console.log(chalk.gray(`Output: ${outputFile}\n`));

  const workDir = path.join(targetDir, '.tmp', 'debug-export');
  await fs.ensureDir(workDir);

  // Step 1: Collect log tails
  const step1 = ora('Collecting log tails...').start();
  try {
    const logsDir = path.join(workDir, 'logs');
    await fs.ensureDir(logsDir);
    
    // Bot-runner logs
    const botRunnerLog = path.join(targetDir, 'state', 'bot-runner.log');
    if (await fs.pathExists(botRunnerLog)) {
      try {
        const tail = execSync(`tail -n 1000 "${botRunnerLog}"`, { encoding: 'utf8' });
        await fs.writeFile(path.join(logsDir, 'bot-runner-tail.log'), tail);
      } catch {}
    }
    
    // Health check logs
    const healthLog = path.join(targetDir, 'state', 'health.json');
    if (await fs.pathExists(healthLog)) {
      await fs.copy(healthLog, path.join(logsDir, 'health.json'));
    }
    
    step1.succeed('Log tails collected');
  } catch (err) {
    step1.warn(`Could not collect all logs: ${err.message}`);
  }

  // Step 2: Collect configs
  const step2 = ora('Collecting configs...').start();
  try {
    const configsDir = path.join(workDir, 'configs');
    await fs.ensureDir(configsDir);
    
    const configFiles = [
      'core/TRADING_CONFIG.md',
      'core/RISK_RULES.md',
      'core/STRATEGIES.md',
      '.config/trading.toml',
      'state/config_effective.json',
      'state/governor.json'
    ];
    
    for (const file of configFiles) {
      const src = path.join(targetDir, file);
      if (await fs.pathExists(src)) {
        const dest = path.join(configsDir, path.basename(file));
        await fs.copy(src, dest);
      }
    }
    
    step2.succeed('Configs collected');
  } catch (err) {
    step2.warn(`Could not collect all configs: ${err.message}`);
  }

  // Step 3: Collect recent incidents
  const step3 = ora('Collecting recent incidents...').start();
  try {
    const incidentsDir = path.join(workDir, 'incidents');
    await fs.ensureDir(incidentsDir);
    
    const incidentsSrc = path.join(targetDir, 'reports', 'incidents');
    if (await fs.pathExists(incidentsSrc)) {
      const files = await fs.readdir(incidentsSrc);
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      
      for (const file of files) {
        const src = path.join(incidentsSrc, file);
        const stat = await fs.stat(src);
        if (stat.mtime.getTime() > cutoff) {
          await fs.copy(src, path.join(incidentsDir, file));
        }
      }
    }
    
    step3.succeed('Recent incidents collected');
  } catch (err) {
    step3.warn(`Could not collect incidents: ${err.message}`);
  }

  // Step 4: Collect portfolio snapshots
  const step4 = ora('Collecting portfolio snapshots...').start();
  try {
    const portfolioDir = path.join(workDir, 'portfolio');
    await fs.ensureDir(portfolioDir);
    
    // Current snapshot
    const currentSnapshot = path.join(targetDir, 'state', 'portfolio_snapshot.json');
    if (await fs.pathExists(currentSnapshot)) {
      await fs.copy(currentSnapshot, path.join(portfolioDir, 'portfolio_snapshot.json'));
    }
    
    // Wallet snapshot
    const walletSnapshot = path.join(targetDir, 'state', 'wallet_snapshot.json');
    if (await fs.pathExists(walletSnapshot)) {
      await fs.copy(walletSnapshot, path.join(portfolioDir, 'wallet_snapshot.json'));
    }
    
    step4.succeed('Portfolio snapshots collected');
  } catch (err) {
    step4.warn(`Could not collect snapshots: ${err.message}`);
  }

  // Step 5: Collect recent events
  const step5 = ora('Collecting recent events...').start();
  try {
    const eventsDir = path.join(workDir, 'events');
    await fs.ensureDir(eventsDir);
    
    // Daily recaps from last N days
    const recapsDir = path.join(targetDir, 'journal', 'recaps');
    if (await fs.pathExists(recapsDir)) {
      const files = await fs.readdir(recapsDir);
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      
      let count = 0;
      for (const file of files.sort().reverse()) {
        if (count >= 200) break;
        const src = path.join(recapsDir, file);
        const stat = await fs.stat(src);
        if (stat.mtime.getTime() > cutoff) {
          await fs.copy(src, path.join(eventsDir, file));
          count++;
        }
      }
    }
    
    step5.succeed('Recent events collected');
  } catch (err) {
    step5.warn(`Could not collect events: ${err.message}`);
  }

  // Step 6: Create manifest
  const step6 = ora('Creating manifest...').start();
  try {
    const manifest = {
      export_created: new Date().toISOString(),
      time_range_hours: hours,
      workspace: targetDir,
      agent_name: options.agentName || 'Jane',
      files_collected: {
        logs: await countFiles(path.join(workDir, 'logs')),
        configs: await countFiles(path.join(workDir, 'configs')),
        incidents: await countFiles(path.join(workDir, 'incidents')),
        portfolio: await countFiles(path.join(workDir, 'portfolio')),
        events: await countFiles(path.join(workDir, 'events'))
      }
    };
    
    await fs.writeFile(path.join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    step6.succeed('Manifest created');
  } catch (err) {
    step6.warn(`Could not create manifest: ${err.message}`);
  }

  // Step 7: Create tarball
  const step7 = ora('Creating tarball...').start();
  try {
    const outputPath = path.resolve(outputFile);
    execSync(`tar -czf "${outputPath}" -C "${workDir}" .`, { cwd: targetDir });
    step7.succeed(`Bundle created: ${outputPath}`);
    
    // Clean up work dir
    await fs.remove(workDir);
    
    console.log(chalk.bold.green('\n✅ Debug export complete!\n'));
    console.log(chalk.white('Bundle includes:'));
    console.log(chalk.gray('  - Log tails (bot-runner, health)'));
    console.log(chalk.gray('  - Current configs (trading, risk, strategies)'));
    console.log(chalk.gray('  - Recent incidents'));
    console.log(chalk.gray('  - Portfolio and wallet snapshots'));
    console.log(chalk.gray('  - Daily recaps (up to 200 events)'));
    console.log(chalk.gray('  - Manifest with metadata'));
    console.log();
    console.log(chalk.gray(`Share this file for support: ${outputPath}`));
    console.log();
  } catch (err) {
    step7.fail(`Failed to create bundle: ${err.message}`);
    throw err;
  }
}

async function countFiles(dir) {
  try {
    const files = await fs.readdir(dir);
    return files.length;
  } catch {
    return 0;
  }
}

module.exports = { exportDebugCommand };
