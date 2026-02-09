const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');

const { setupTraderStructure } = require('../utils/trader-structure');
const { setupTraderScripts } = require('../utils/trader-scripts');
const { setupTraderCron } = require('../utils/trader-cron');
const { renderTemplate } = require('../utils/templates');
const { promptOpenClawConfig, renderOpenClawConfig, writeOpenClawConfig } = require('../utils/openclaw-config');

/**
 * Install trader component - full trading environment setup
 * Steps:
 * 1. Create workspace dirs + files
 * 2. Prompt for OpenClaw config (LLM, Telegram)
 * 3. Install binaries / validate paths
 * 4. Write configs (TOML, env, OpenClaw)
 * 5. Create systemd units
 * 6. Set cron jobs
 * 7. Run doctor checks and print green lights report
 */
async function installTraderCommand(options) {
  const targetDir = path.resolve(options.dir);
  const force = Boolean(options.force);
  const agentName = options.agentName || 'Jane';
  const ownerName = options.ownerName || 'Owner';

  console.log(chalk.bold.blue('\n🦞 Installing Trading Environment\n'));
  console.log(chalk.gray(`Target: ${targetDir}`));
  console.log(chalk.gray(`Agent: ${agentName}`));
  console.log(chalk.gray(`Owner: ${ownerName}\n`));

  // Step 1: Create workspace dirs + files
  const step1 = ora('Step 1/6: Creating workspace structure...').start();
  try {
    await fs.ensureDir(targetDir);
    await setupTraderStructure(targetDir, { force });
    
    // Create all initial files
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const nextCheckIn = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    // Core files
    const coreFiles = [
      { name: 'core/MEMORY.md', template: 'MEMORY.md', data: { date: today, agentName, ownerName } },
      { name: 'core/SOUL.md', template: 'SOUL.md', data: { agentName } },
      { name: 'core/USER.md', template: 'USER.md', data: { ownerName } },
      { name: 'core/AGENTS.md', template: 'AGENTS.md', data: { date: today } },
      { name: 'core/TRADING_CONFIG.md', template: 'TRADING_CONFIG.md', data: { date: today, agentName } },
      { name: 'core/RISK_RULES.md', template: 'RISK_RULES.md', data: { date: today } },
      { name: 'core/STRATEGIES.md', template: 'STRATEGIES.md', data: { date: today } },
      { name: 'core/VOICE.md', template: 'VOICE.md', data: { date: today } }
    ];
    
    for (const file of coreFiles) {
      const filePath = path.join(targetDir, file.name);
      if (!await fs.pathExists(filePath) || force) {
        const content = renderTemplate(file.template, file.data);
        await fs.writeFile(filePath, content);
      }
    }

    // Constitution
    await fs.ensureDir(path.join(targetDir, 'knowledge', 'pinned'));
    const constitutionPath = path.join(targetDir, 'knowledge', 'pinned', 'CONSTITUTION.md');
    if (!await fs.pathExists(constitutionPath) || force) {
      await fs.writeFile(constitutionPath, renderTemplate('CONSTITUTION.md', { date: today }));
    }

    // Templates including decisions
    const templates = [
      { dir: 'journal/trades', name: 'TEMPLATE.md', template: 'TRADE_TEMPLATE.md' },
      { dir: 'journal/recaps', name: 'DAILY_TEMPLATE.md', template: 'DAILY_TEMPLATE.md' },
      { dir: 'journal/decisions', name: 'TEMPLATE.md', template: 'DECISION_TEMPLATE.md' },
      { dir: 'reports/incidents', name: 'TEMPLATE.md', template: 'INCIDENT_TEMPLATE.md' }
    ];
    
    for (const tmpl of templates) {
      await fs.ensureDir(path.join(targetDir, tmpl.dir));
      const filePath = path.join(targetDir, tmpl.dir, tmpl.name);
      if (!await fs.pathExists(filePath) || force) {
        await fs.writeFile(filePath, renderTemplate(tmpl.template, {}));
      }
    }

    // Auto-incident templates for bot-runner
    const autoIncidentMdPath = path.join(targetDir, 'reports', 'incidents', 'AUTO_INCIDENT_TEMPLATE.md');
    if (!await fs.pathExists(autoIncidentMdPath) || force) {
      await fs.writeFile(autoIncidentMdPath, renderTemplate('AUTO_INCIDENT_TEMPLATE.md', {
        incidentType: 'template',
        timestamp: now,
        status: 'template',
        symptoms: '[Auto-filled from error]',
        likelyCause: '[Mapped from error code]',
        errorCode: 'ERROR_CODE',
        moneyLost: '$0',
        tradingStopped: 'No',
        positionsAffected: '0',
        duration: 'N/A',
        botActions: '[Auto-filled from action log]',
        recommendedFix: '[Based on error type]',
        filename: 'TEMPLATE.md'
      }));
    }

    const autoIncidentJsonPath = path.join(targetDir, 'reports', 'incidents', 'AUTO_INCIDENT_TEMPLATE.json');
    if (!await fs.pathExists(autoIncidentJsonPath) || force) {
      await fs.writeFile(autoIncidentJsonPath, renderTemplate('AUTO_INCIDENT_TEMPLATE.json', {
        incidentId: 'template',
        timestamp: now,
        incidentType: 'template'
      }));
    }

    // A/B Episodes templates
    await fs.ensureDir(path.join(targetDir, 'episodes'));
    const recapTemplatePath = path.join(targetDir, 'episodes', 'RECAP_TEMPLATE.md');
    if (!await fs.pathExists(recapTemplatePath) || force) {
      await fs.writeFile(recapTemplatePath, renderTemplate('EPISODE_RECAP_TEMPLATE.md', {}));
    }

    // Suggestions templates
    await fs.ensureDir(path.join(targetDir, 'suggestions'));
    
    // Pending queue
    const pendingPath = path.join(targetDir, 'suggestions', 'pending.json');
    if (!await fs.pathExists(pendingPath) || force) {
      await fs.writeFile(pendingPath, renderTemplate('SUGGESTIONS_PENDING_JSON', { timestamp: now }));
\n  }

    // Conversation memory - preference candidates (requires confirmation)
    await fs.ensureDir(path.join(targetDir, 'knowledge', 'candidates'));
    const candidatesPath = path.join(targetDir, 'knowledge', 'candidates', 'preferences.json');
    if (!await fs.pathExists(candidatesPath) || force) {
      await fs.writeFile(candidatesPath, renderTemplate('CANDIDATES_PREFERENCES_JSON'));
    }
    
    // Individual suggestion template
    const suggestionTemplatePath = path.join(targetDir, 'suggestions', 'SUGGESTION_TEMPLATE.json');
    if (!await fs.pathExists(suggestionTemplatePath) || force) {
      await fs.writeFile(suggestionTemplatePath, renderTemplate('SUGGESTION_JSON', { 
        suggestionId: 'template',
        timestamp: now 
      }));
    }
    
    // State files including now.json (live status)
    await fs.ensureDir(path.join(targetDir, 'state'));
    
    const healthPath = path.join(targetDir, 'state', 'health.json');
    if (!await fs.pathExists(healthPath) || force) {
      await fs.writeFile(healthPath, JSON.stringify({
        last_check: now,
        runner_pid: null,
        claw_trader_available: false
      }, null, 2));
    }
    
    const nowPath = path.join(targetDir, 'state', 'now.json');
    if (!await fs.pathExists(nowPath) || force) {
      await fs.writeFile(nowPath, renderTemplate('NOW_JSON', { 

    // Hard safety governor - local kill switch
    const governorPath = path.join(targetDir, 'state', 'governor.json');
    if (!await fs.pathExists(governorPath) || force) {
      await fs.writeFile(governorPath, renderTemplate('GOVERNOR_JSON', { timestamp: now }));
    }
    
    // Wallet snapshot template - periodic snapshots (no keys)
    const walletSnapshotPath = path.join(targetDir, 'state', 'wallet_snapshot.json');
    if (!await fs.pathExists(walletSnapshotPath) || force) {
      await fs.writeFile(walletSnapshotPath, renderTemplate('WALLET_SNAPSHOT_JSON', { timestamp: now }));
    }
    
    step1.succeed('Workspace structure created');
  } catch (err) {
    step1.fail(`Failed: ${err.message}`);
    throw err;
  }

  // Step 2: Prompt for OpenClaw configuration
  const step2 = ora('Step 2/7: Configuring OpenClaw (LLM + Telegram)...').start();
  let openclawConfig = null;
  try {
    if (!options.yes) {
      // Interactive mode - prompt user
      const answers = await promptOpenClawConfig();
      openclawConfig = renderOpenClawConfig({
        botId: process.env.BOT_ID || '',
        agentName,
        persona: 'direct',
        llm: answers.llm,
        channels: answers.channels,
        workspaceDir: targetDir
      });
    } else {
      // Non-interactive mode - use defaults
      openclawConfig = renderOpenClawConfig({
        botId: process.env.BOT_ID || '',
        agentName,
        persona: 'direct',
        llm: {
          provider: 'openai',
          model: 'gpt-4o',
          apiKey: process.env.OPENCLAW_LLM_API_KEY || ''
        },
        channels: {
          telegram: {
            enabled: !!process.env.TELEGRAM_BOT_TOKEN,
            botToken: process.env.TELEGRAM_BOT_TOKEN || ''
          },
          discord: {
            enabled: !!process.env.DISCORD_BOT_TOKEN,
            botToken: process.env.DISCORD_BOT_TOKEN || ''
          }
        },
        workspaceDir: targetDir
      });
    }
    
    await writeOpenClawConfig(targetDir, openclawConfig);
    step2.succeed('OpenClaw configured');
  } catch (err) {
    step2.fail(`Failed: ${err.message}`);
    throw err;
  }

  // Step 3: Install binaries / validate paths
  const step2 = ora('Step 3/7: Validating binaries...').start();
  const binaryChecks = {
    botRunner: { path: null, found: false },
    clawTrader: { path: null, found: false }
  };
  
  try {
    // Check bot-runner
    try {
      const botRunnerPath = execSync('which bot-runner', { encoding: 'utf8' }).trim();
      binaryChecks.botRunner = { path: botRunnerPath, found: true };
    } catch {
      // Try common locations
      const commonPaths = [
        '/usr/local/bin/bot-runner',
        '/opt/trawling-traders/bin/bot-runner',
        path.join(targetDir, 'bin', 'bot-runner')
      ];
      for (const p of commonPaths) {
        if (await fs.pathExists(p)) {
          binaryChecks.botRunner = { path: p, found: true };
          break;
        }
      }
    }

    // Check claw-trader
    try {
      const clawTraderPath = execSync('which claw-trader', { encoding: 'utf8' }).trim();
      binaryChecks.clawTrader = { path: clawTraderPath, found: true };
    } catch {
      const commonPaths = [
        '/usr/local/bin/claw-trader',
        '/opt/trawling-traders/bin/claw-trader',
        path.join(targetDir, 'bin', 'claw-trader')
      ];
      for (const p of commonPaths) {
        if (await fs.pathExists(p)) {
          binaryChecks.clawTrader = { path: p, found: true };
          break;
        }
      }
    }

    // Check OpenClaw gateway (optional but recommended)
    try {
      const openclawPath = execSync('which openclaw', { encoding: 'utf8' }).trim();
      binaryChecks.openclaw = { path: openclawPath, found: true };
    } catch {
      const commonPaths = [
        '/usr/local/bin/openclaw',
        '/opt/openclaw/bin/openclaw',
      ];
      for (const p of commonPaths) {
        if (await fs.pathExists(p)) {
          binaryChecks.openclaw = { path: p, found: true };
          break;
        }
      }
    }

    const missingBinaries = [];
    if (!binaryChecks.botRunner.found) missingBinaries.push('bot-runner');
    if (!binaryChecks.clawTrader.found) missingBinaries.push('claw-trader');
    
    if (missingBinaries.length > 0) {
      step2.warn(`Some binaries not found: ${missingBinaries.join(', ')}`);
      if (!binaryChecks.botRunner.found) {
        console.log(chalk.yellow('  ⚠ bot-runner not found - install to /usr/local/bin or provide path'));
      }
      if (!binaryChecks.clawTrader.found) {
        console.log(chalk.yellow('  ⚠ claw-trader not found - install to /usr/local/bin or provide path'));
      }
    } else {
      const openclawStatus = binaryChecks.openclaw?.found ? ', openclaw' : '';
      step2.succeed(`Binaries validated: bot-runner, claw-trader${openclawStatus}`);
    }
    
    if (!binaryChecks.openclaw?.found) {
      console.log(chalk.yellow('  ⚠ openclaw not found - bot-runner will run without OpenClaw integration'));
    }
  } catch (err) {
    step2.fail(`Failed: ${err.message}`);
  }

  // Step 3: Write config TOML + env
  const step3 = ora('Step 4/8: Writing configuration...').start();
  try {
    // Create config directory
    const configDir = path.join(targetDir, '.config');
    await fs.ensureDir(configDir);

    // Write trading.toml (bot-runner config)
    const tradingToml = `# Trading Configuration
# Generated by downrigger install trader

[control_plane]
url = "${process.env.CONTROL_PLANE_URL || 'https://api.trawlingtraders.com'}"
bot_id = "${process.env.BOT_ID || ''}"
registration_token = "${process.env.REGISTRATION_TOKEN || ''}"
poll_interval_secs = 30

[execution]
mode = "paper"  # paper or live
max_price_impact_pct = 2.0
max_slippage_bps = 50
confirm_timeout_secs = 60
quote_cache_secs = 30

[wallet]
path = "${path.join(targetDir, '.config', 'wallet.json')}"

[solana]
rpc_url = "${process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'}"

[jupiter]
api_key = "${process.env.JUPITER_API_KEY || ''}"
`;
    await fs.writeFile(path.join(configDir, 'trading.toml'), tradingToml);

    // Write .env file (for sourcing in scripts)
    // All env vars have sensible defaults - only set to override
    const envFile = `# Trading Environment
# Generated by downrigger install trader
# Source this in your shell: source ${path.join(configDir, '.env')}

# Required (no defaults)
export BOT_ID="${process.env.BOT_ID || ''}"
export REGISTRATION_TOKEN="${process.env.REGISTRATION_TOKEN || ''}"

# Optional (defaults shown)
export CONTROL_PLANE_URL="${process.env.CONTROL_PLANE_URL || 'https://api.trawlingtraders.com'}"
export DATA_RETRIEVAL_URL="${process.env.DATA_RETRIEVAL_URL || 'https://data.trawlingtraders.com'}"
export SOLANA_RPC_URL="${process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'}"
export JUPITER_API_KEY="${process.env.JUPITER_API_KEY || ''}"

# Workspace paths
export DOWNRIGGER_DIR="${targetDir}"
export AGENT_WALLET_PATH="${path.join(targetDir, '.config', 'wallet.json')}"

# OpenClaw gateway (defaults to localhost)
export OPENCLAW_GATEWAY_URL="${process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8081'}"
export OPENCLAW_SERVICE="${process.env.OPENCLAW_SERVICE || 'openclaw-gateway'}"
`;
    await fs.writeFile(path.join(configDir, '.env'), envFile);
    
    step3.succeed('Configuration written');
  } catch (err) {
    step3.fail(`Failed: ${err.message}`);
    throw err;
  }

  // Step 4: Setup SQLite databases (new step for trading tracking)
  const sqliteSpinner = ora('Step 4/8: Setting up SQLite tracking databases...').start();
  try {
    const { setupTraderSQLite } = require('../utils/trader-sqlite');
    const sqliteScripts = await setupTraderSQLite(targetDir, { force });
    sqliteSpinner.succeed(`SQLite databases configured: ${sqliteScripts.join(', ')}`);
  } catch (err) {
    sqliteSpinner.fail(`SQLite setup failed: ${err.message}`);
  }

  // Step 5: Create systemd unit
  const step4 = ora('Step 5/8: Creating systemd service...').start();
  try {
    const systemdDir = '/etc/systemd/system';
    const serviceName = 'bot-runner.service';
    const servicePath = path.join(systemdDir, serviceName);
    
    const serviceContent = `[Unit]
Description=Trading Bot Runner
After=network.target openclaw-gateway.service
Requires=openclaw-gateway.service

[Service]
Type=simple
User=trader
WorkingDirectory=${targetDir}
Environment=DOWNRIGGER_DIR=${targetDir}
Environment=CONTROL_PLANE_URL=${process.env.CONTROL_PLANE_URL || 'https://api.trawlingtraders.com'}
Environment=DATA_RETRIEVAL_URL=${process.env.DATA_RETRIEVAL_URL || 'https://data.trawlingtraders.com'}
Environment=BOT_ID=${process.env.BOT_ID || ''}
Environment=REGISTRATION_TOKEN=${process.env.REGISTRATION_TOKEN || ''}
Environment=JUPITER_API_KEY=${process.env.JUPITER_API_KEY || ''}
Environment=SOLANA_RPC_URL=${process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'}
Environment=AGENT_WALLET_PATH=${path.join(targetDir, '.config', 'wallet.json')}
Environment=OPENCLAW_GATEWAY_URL=${process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8081'}
Environment=RUST_LOG=info
ExecStart=${binaryChecks.botRunner.found ? binaryChecks.botRunner.path : '/usr/local/bin/bot-runner'}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
    
    // Write to target dir first (user can sudo cp later)
    await fs.writeFile(path.join(targetDir, serviceName), serviceContent);
    
    step4.succeed(`Systemd service created (${serviceName} in workspace)`);
    console.log(chalk.gray(`  To install: sudo cp ${path.join(targetDir, serviceName)} ${servicePath}`));
    console.log(chalk.gray(`  Then: sudo systemctl daemon-reload && sudo systemctl enable --now ${serviceName}`));
  } catch (err) {
    step4.fail(`Failed: ${err.message}`);
  }

  // Step 5: Set cron jobs
  const step5 = ora('Step 6/8: Setting up cron jobs...').start();
  try {
    const result = await setupTraderCron(targetDir, { agentName, force });
    step5.succeed(`Cron jobs configured: ${result.created.length} new`);
    if (result.restartRequired) {
      console.log(chalk.yellow('  ⚠️  Restart OpenClaw gateway to apply: openclaw gateway restart'));
    }
  } catch (err) {
    step5.fail(`Failed: ${err.message}`);
    console.log(chalk.yellow('  You may need to manually configure cron jobs'));
  }

  // Step 6: Run doctor checks
  const step6 = ora('Step 7/8: Running health checks...').start();
  try {
    const results = await runTraderHealthChecks(targetDir, binaryChecks);
    step6.succeed('Health checks complete');
    
    // Print green lights report
    printGreenLightsReport(results);
  } catch (err) {
    step6.fail(`Failed: ${err.message}`);
  }

  console.log(chalk.bold.green('\n✅ Trading environment installation complete!\n'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray(`  1. Review config: cat ${path.join(targetDir, '.config', 'trading.toml')}`));
  console.log(chalk.gray(`  2. Install service: sudo cp ${path.join(targetDir, 'bot-runner.service')} /etc/systemd/system/`));
  console.log(chalk.gray(`  3. Start service: sudo systemctl daemon-reload && sudo systemctl enable --now bot-runner`));
  console.log(chalk.gray(`  4. Check status: downrigger doctor`));
  console.log();
}

/**
 * Run trader-specific health checks
 */
async function runTraderHealthChecks(targetDir, binaryChecks) {
  const results = {
    checks: [],
    healthy: 0,
    warnings: 0,
    errors: 0
  };

  // Check 1: Control plane reachable
  const cpUrl = process.env.CONTROL_PLANE_URL || 'https://api.trawlingtraders.com';
  try {
    execSync(`curl -sf ${cpUrl}/healthz -o /dev/null`, { timeout: 5000 });
    results.checks.push({ name: 'Control Plane', status: 'ok', message: `${cpUrl} reachable` });
    results.healthy++;
  } catch {
    results.checks.push({ name: 'Control Plane', status: 'error', message: `${cpUrl} not reachable` });
    results.errors++;
  }

  // Check 2: claw-trader can run price quote
  if (binaryChecks.clawTrader.found) {
    try {
      // Try a trivial quote (USDC is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
      const output = execSync(
        `${binaryChecks.clawTrader.path} price EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --json 2>/dev/null || echo '{"error": "failed"}'`,
        { encoding: 'utf8', timeout: 10000 }
      );
      const parsed = JSON.parse(output);
      if (parsed.price || parsed.data) {
        results.checks.push({ name: 'claw-trader Price', status: 'ok', message: 'Can fetch prices' });
        results.healthy++;
      } else {
        results.checks.push({ name: 'claw-trader Price', status: 'warn', message: 'Price fetch returned unexpected format' });
        results.warnings++;
      }
    } catch (err) {
      results.checks.push({ name: 'claw-trader Price', status: 'warn', message: `Price fetch failed: ${err.message}` });
      results.warnings++;
    }
  } else {
    results.checks.push({ name: 'claw-trader Price', status: 'error', message: 'claw-trader not installed' });
    results.errors++;
  }

  // Check 3: Wallet exists and readable
  const walletPath = path.join(targetDir, '.config', 'wallet.json');
  if (await fs.pathExists(walletPath)) {
    try {
      const walletData = await fs.readJson(walletPath);
      if (walletData.address || walletData.publicKey) {
        results.checks.push({ name: 'Wallet', status: 'ok', message: `Address: ${walletData.address || walletData.publicKey}` });
        results.healthy++;
      } else {
        results.checks.push({ name: 'Wallet', status: 'warn', message: 'Wallet file exists but no address found' });
        results.warnings++;
      }
    } catch {
      results.checks.push({ name: 'Wallet', status: 'warn', message: 'Wallet file exists but cannot parse' });
      results.warnings++;
    }
  } else {
    results.checks.push({ name: 'Wallet', status: 'warn', message: 'Wallet not created yet (will be created on first run)' });
    results.warnings++;
  }

  // Check 4: Runner service (if installed)
  try {
    execSync('systemctl is-active --quiet bot-runner', { stdio: 'ignore' });
    results.checks.push({ name: 'Runner Service', status: 'ok', message: 'Active' });
    results.healthy++;
  } catch {
    try {
      execSync('systemctl is-enabled --quiet bot-runner', { stdio: 'ignore' });
      results.checks.push({ name: 'Runner Service', status: 'warn', message: 'Enabled but not running' });
      results.warnings++;
    } catch {
      results.checks.push({ name: 'Runner Service', status: 'warn', message: 'Not installed (run the install steps above)' });
      results.warnings++;
    }
  }

  // Check 5: Disk space
  try {
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const usage = parseInt(dfOutput.trim().split(/\s+/)[4].replace('%', ''));
    if (usage < 80) {
      results.checks.push({ name: 'Disk Space', status: 'ok', message: `${usage}% used` });
      results.healthy++;
    } else if (usage < 90) {
      results.checks.push({ name: 'Disk Space', status: 'warn', message: `${usage}% used` });
      results.warnings++;
    } else {
      results.checks.push({ name: 'Disk Space', status: 'error', message: `${usage}% used - critical` });
      results.errors++;
    }
  } catch {
    results.checks.push({ name: 'Disk Space', status: 'warn', message: 'Could not check disk space' });
    results.warnings++;
  }

  // Check 6: Memory
  try {
    const memOutput = execSync('free | grep Mem', { encoding: 'utf8' });
    const parts = memOutput.trim().split(/\s+/);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    const usage = Math.round((used / total) * 100);
    if (usage < 80) {
      results.checks.push({ name: 'Memory', status: 'ok', message: `${usage}% used` });
      results.healthy++;
    } else {
      results.checks.push({ name: 'Memory', status: 'warn', message: `${usage}% used` });
      results.warnings++;
    }
  } catch {
    results.checks.push({ name: 'Memory', status: 'warn', message: 'Could not check memory' });
    results.warnings++;
  }

  // Check 7: Time sync
  try {
    const syncStatus = execSync('timedatectl show --property=NTPSynchronized --value', { encoding: 'utf8' }).trim();
    if (syncStatus === 'yes') {
      results.checks.push({ name: 'Time Sync', status: 'ok', message: 'NTP synchronized' });
      results.healthy++;
    } else {
      results.checks.push({ name: 'Time Sync', status: 'warn', message: 'NTP not synchronized' });
      results.warnings++;
    }
  } catch {
    results.checks.push({ name: 'Time Sync', status: 'warn', message: 'Could not check time sync' });
    results.warnings++;
  }

  return results;
}

/**
 * Print green lights report
 */
function printGreenLightsReport(results) {
  console.log(chalk.bold.blue('\n🚦 Green Lights Report\n'));
  
  for (const check of results.checks) {
    const symbol = check.status === 'ok' ? chalk.green('✓') : 
                   check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
    const statusColor = check.status === 'ok' ? chalk.green :
                        check.status === 'warn' ? chalk.yellow : chalk.red;
    console.log(`  ${symbol} ${check.name.padEnd(20)} ${statusColor(check.message)}`);
  }
  
  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  ${results.healthy} healthy`));
  if (results.warnings > 0) console.log(chalk.yellow(`  ${results.warnings} warnings`));
  if (results.errors > 0) console.log(chalk.red(`  ${results.errors} errors`));
  
  if (results.errors === 0 && results.warnings === 0) {
    console.log(chalk.bold.green('\n🟢 All green! Trading environment is ready.'));
  } else if (results.errors === 0) {
    console.log(chalk.bold.yellow('\n🟡 Yellow lights - review warnings above.'));
  } else {
    console.log(chalk.bold.red('\n🔴 Red lights - fix errors before trading.'));
  }
}

module.exports = { installTraderCommand, runTraderHealthChecks };
