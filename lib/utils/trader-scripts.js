const fs = require('fs-extra');
const path = require('path');

async function setupTraderScripts(targetDir, options = {}) {
  const { force = false } = options;
  const scriptsDir = path.join(targetDir, 'scripts');
  await fs.ensureDir(scriptsDir);
  
  const created = [];
  
  // Health check script - verify bot-runner and claw-trader status
  const healthCheckScript = `#!/usr/bin/env bash
# health_check.sh - Check trading bot health
# Run every 5 minutes via cron

set -euo pipefail

STATE_DIR="${targetDir}/state"
REPORTS_DIR="${targetDir}/reports/incidents"
mkdir -p "$STATE_DIR" "$REPORTS_DIR"

stamp() {
  date -Iseconds 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ"
}

TODAY=$(date +%Y-%m-%d)
STAMP=$(stamp)

# Check bot-runner process
RUNNER_PID=$(pgrep -f "bot-runner" || echo "")
if [ -z "$RUNNER_PID" ]; then
  echo "{\\"timestamp\\":\\"$STAMP\\",\\"level\\":\\"error\\",\\"component\\":\\"bot-runner\\",\\"status\\":\\"not_running\\"}" >> "$REPORTS_DIR/$TODAY.jsonl"
  echo "[health] $STAMP ERROR: bot-runner not running" >> "${targetDir}/journal/recaps/$TODAY.md"
else
  echo "{\\"timestamp\\":\\"$STAMP\\",\\"level\\":\\"info\\",\\"component\\":\\"bot-runner\\",\\"status\\":\\"running\\",\\"pid\\":$RUNNER_PID}" >> "$STATE_DIR/health.json"
fi

# Check claw-trader CLI
if ! command -v claw-trader &> /dev/null; then
  echo "{\\"timestamp\\":\\"$STAMP\\",\\"level\\":\\"warn\\",\\"component\\":\\"claw-trader\\",\\"status\\":\\"not_installed\\"}" >> "$STATE_DIR/health.json"
fi

# Write health snapshot
cat > "$STATE_DIR/health.json" << EOF
{
  "last_check": "$STAMP",
  "runner_pid": ${RUNNER_PID:-null},
  "claw_trader_available": $(command -v claw-trader &> /dev/null && echo "true" || echo "false")
}
EOF
`;

  const healthPath = path.join(scriptsDir, 'health_check.sh');
  if (!await fs.pathExists(healthPath) || force) {
    await fs.writeFile(healthPath, healthCheckScript);
    await fs.chmod(healthPath, 0o755);
    created.push('health_check.sh');
  }
  
  // Report wallet script - report wallet address to control plane
  const reportWalletScript = `#!/usr/bin/env bash
# report_wallet.sh - Report wallet address to control plane
# Run once at boot, then weekly

set -euo pipefail

STATE_DIR="${targetDir}/state"
mkdir -p "$STATE_DIR"

# Get wallet address from claw-trader
WALLET=$(claw-trader wallet address 2>/dev/null || echo "")

if [ -n "$WALLET" ]; then
  # Save to state
  echo "$WALLET" > "$STATE_DIR/wallet_address.txt"
  
  # Report to control plane (if configured)
  if [ -n "${CONTROL_PLANE_URL:-}" ] && [ -n "${BOT_ID:-}" ]; then
    curl -X POST "${CONTROL_PLANE_URL}/v1/bot/${BOT_ID}/wallet" \\
      -H "Content-Type: application/json" \\
      -d "{\\"address\\":\\"$WALLET\\"}" 2>/dev/null || true
  fi
fi
`;

  const walletPath = path.join(scriptsDir, 'report_wallet.sh');
  if (!await fs.pathExists(walletPath) || force) {
    await fs.writeFile(walletPath, reportWalletScript);
    await fs.chmod(walletPath, 0o755);
    created.push('report_wallet.sh');
  }
  
  // Restart runner script - restart bot-runner on failure
  const restartRunnerScript = `#!/usr/bin/env bash
# restart_runner.sh - Restart bot-runner if not running
# Run every minute via cron

set -euo pipefail

STATE_DIR="${targetDir}/state"
REPORTS_DIR="${targetDir}/reports/incidents"
mkdir -p "$STATE_DIR" "$REPORTS_DIR"

stamp() {
  date -Iseconds 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ"
}

TODAY=$(date +%Y-%m-%d)
STAMP=$(stamp)

# Check if bot-runner is running
if ! pgrep -f "bot-runner" > /dev/null; then
  echo "[incident] $STAMP bot-runner not running, attempting restart" >> "$REPORTS_DIR/$TODAY.md"
  
  # Restart bot-runner (requires environment setup)
  if [ -f "$STATE_DIR/bot_runner.env" ]; then
    export $(cat "$STATE_DIR/bot_runner.env" | xargs)
    nohup bot-runner > "$STATE_DIR/bot-runner.log" 2>&1 &
    echo "[incident] $STAMP bot-runner restarted" >> "$REPORTS_DIR/$TODAY.md"
  fi
fi
`;

  const restartPath = path.join(scriptsDir, 'restart_runner.sh');
  if (!await fs.pathExists(restartPath) || force) {
    await fs.writeFile(restartPath, restartRunnerScript);
    await fs.chmod(restartPath, 0o755);
    created.push('restart_runner.sh');
  }
  
  // Reconcile now script - force holdings reconciliation
  const reconcileScript = `#!/usr/bin/env bash
# reconcile_now.sh - Trigger immediate holdings reconciliation
# Manual trigger or via cron

set -euo pipefail

STATE_DIR="${targetDir}/state"
JOURNAL_DIR="${targetDir}/journal/trades"
mkdir -p "$STATE_DIR" "$JOURNAL_DIR"

stamp() {
  date -Iseconds 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ"
}

TODAY=$(date +%Y-%m-%d)
STAMP=$(stamp)

# Trigger reconciliation via bot-runner API or direct call
if [ -n "${CONTROL_PLANE_URL:-}" ] && [ -n "${BOT_ID:-}" ]; then
  # Signal to bot-runner to reconcile
  echo "{\\"timestamp\\":\\"$STAMP\\",\\"action\\":\\"reconcile_requested\\"}" >> "$STATE_DIR/last_cycle.json"
  echo "[reconcile] $STAMP Holdings reconciliation triggered" >> "$JOURNAL_DIR/$TODAY.md"
fi
`;

  const reconcilePath = path.join(scriptsDir, 'reconcile_now.sh');
  if (!await fs.pathExists(reconcilePath) || force) {
    await fs.writeFile(reconcilePath, reconcileScript);
    await fs.chmod(reconcilePath, 0o755);
    created.push('reconcile_now.sh');
  }
  
  // Summarize day script - generate daily recap
  const summarizeScript = `#!/usr/bin/env bash
# summarize_day.sh - Generate daily trading recap
# Run at 11:55pm via cron

set -euo pipefail

JOURNAL_DIR="${targetDir}/journal"
REPORTS_DIR="${targetDir}/reports/daily_pnl"
STATE_DIR="${targetDir}/state"
mkdir -p "$JOURNAL_DIR/recaps" "$REPORTS_DIR" "$STATE_DIR"

stamp() {
  date -Iseconds 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ"
}

TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -d '1 day ago' +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)
STAMP=$(stamp)

# Create daily recap template
cat > "$JOURNAL_DIR/recaps/$TODAY.md" << EOF
# Daily Recap: $TODAY

## What I Did Today
- [ ] Trades executed: (to be filled by bot-runner)
- [ ] Config changes: (check state/config_effective.json)
- [ ] Strategy adjustments: (check journal/decisions/)

## What I Learned
- Market conditions:
- Execution patterns:
- Risk events:

## Tomorrow's Recommendations
- Pending setups:
- Risk considerations:
- Focus areas:

## Stats
- PnL: (check reports/daily_pnl/$TODAY.md)
- Trade count:
- Win rate:

---
Generated: $STAMP
EOF

# Copy portfolio snapshot
cp "$STATE_DIR/portfolio_snapshot.json" "$REPORTS_DIR/${TODAY}_portfolio.json" 2>/dev/null || true

echo "[recap] $STAMP Daily recap template created for $TODAY"
`;

  const summarizePath = path.join(scriptsDir, 'summarize_day.sh');
  if (!await fs.pathExists(summarizePath) || force) {
    await fs.writeFile(summarizePath, summarizeScript);
    await fs.chmod(summarizePath, 0o755);
    created.push('summarize_day.sh');
  }
  
  return created;
}

module.exports = { setupTraderScripts };
