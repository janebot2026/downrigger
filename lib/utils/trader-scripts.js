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
  
  // Daily recap script - generates structured daily recap template
  const dailyRecapScript = `#!/usr/bin/env bash
# daily_recap.sh - Generate daily trading recap structure
# Run at 11:55pm via cron
# Note: This creates the template. The agent fills it during Daily Synthesis agentTurn.

set -euo pipefail

JOURNAL_DIR="${targetDir}/journal"
REPORTS_DIR="${targetDir}/reports/daily_pnl"
STATE_DIR="${targetDir}/state"
mkdir -p "$JOURNAL_DIR/recaps" "$REPORTS_DIR" "$STATE_DIR"

stamp() {
  date -Iseconds 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ"
}

TODAY=$(date +%Y-%m-%d)
STAMP=$(stamp)

# Check if recap already exists (don't overwrite if agent has written to it)
RECAP_FILE="$JOURNAL_DIR/recaps/$TODAY.md"
if [ -f "$RECAP_FILE" ] && grep -q "What Happened Today" "$RECAP_FILE" 2>/dev/null; then
  echo "[recap] $STAMP Daily recap already exists, skipping template"
  exit 0
fi

# Create daily recap template
cat > "$RECAP_FILE" << 'EOF'
# Daily Recap: DATE_PLACEHOLDER

## What Happened Today
- Trades executed: (count)
- Blocks encountered: (what stopped trades)
- Errors/incidents: (if any)

## What Worked / What Didn't
- ✅ Worked: 
- ❌ Didn't: 

## Top 3 Learnings
1. 
2. 
3. 

## Suggested Tweaks (1-3, small + reversible)
1. 
2. 
3. 

## Stats
- PnL: 
- Trade count: 
- Win rate: 

---
*Template created: TIMESTAMP_PLACEHOLDER*
*Fill during Daily Synthesis agentTurn*
EOF

# Replace placeholders
sed -i "s/DATE_PLACEHOLDER/$TODAY/g" "$RECAP_FILE"
sed -i "s/TIMESTAMP_PLACEHOLDER/$STAMP/g" "$RECAP_FILE"

echo "[recap] $STAMP Daily recap template created for $TODAY"
`;

  const dailyRecapPath = path.join(scriptsDir, 'daily_recap.sh');
  if (!await fs.pathExists(dailyRecapPath) || force) {
    await fs.writeFile(dailyRecapPath, dailyRecapScript);
    await fs.chmod(dailyRecapPath, 0o755);
    created.push('daily_recap.sh');
  }

  // Weekly synthesis script - generates weekly recap structure
  const weeklySynthesisScript = `#!/usr/bin/env bash
# weekly_synthesis.sh - Generate weekly synthesis structure
# Run Monday 9am via cron
# Note: This creates the template. The agent fills it during Weekly Synthesis agentTurn.

set -euo pipefail

JOURNAL_DIR="${targetDir}/journal"
KNOWLEDGE_DIR="${targetDir}/knowledge"
mkdir -p "$JOURNAL_DIR/recaps" "$KNOWLEDGE_DIR/tacit"

stamp() {
  date -Iseconds 2>/dev/null || date -u "+%Y-%m-%dT%H:%M:%SZ"
}

# Get week number
WEEK=$(date +%Y-W%V)
STAMP=$(stamp)

# Check if weekly recap already exists
WEEKLY_FILE="$JOURNAL_DIR/recaps/WEEK-$WEEK.md"
if [ -f "$WEEKLY_FILE" ] && grep -q "Behavior Changes" "$WEEKLY_FILE" 2>/dev/null; then
  echo "[weekly] $STAMP Weekly synthesis already exists, skipping template"
  exit 0
fi

# Create weekly synthesis template
cat > "$WEEKLY_FILE" << 'EOF'
# Weekly Synthesis: WEEK_PLACEHOLDER

## Behavior Changes This Week
- Strategy adjustments: 
- Risk rule changes: 
- Execution pattern shifts: 

## Market Conditions Impact
- Helped performance: 
- Hurt performance: 
- Neutral/unclear: 

## Rules to Pin (confirmed working)
- 

## Rules to Delete (not working/outdated)
- 

## New Tacit Knowledge
(Add to knowledge/tacit/ after review)

---
*Template created: TIMESTAMP_PLACEHOLDER*
*Fill during Weekly Synthesis agentTurn*
*Update knowledge/tacit/ with confirmed patterns*
EOF

# Replace placeholders
sed -i "s/WEEK_PLACEHOLDER/$WEEK/g" "$WEEKLY_FILE"
sed -i "s/TIMESTAMP_PLACEHOLDER/$STAMP/g" "$WEEKLY_FILE"

echo "[weekly] $STAMP Weekly synthesis template created for $WEEK"
`;

  const weeklyPath = path.join(scriptsDir, 'weekly_synthesis.sh');
  if (!await fs.pathExists(weeklyPath) || force) {
    await fs.writeFile(weeklyPath, weeklySynthesisScript);
    await fs.chmod(weeklyPath, 0o755);
    created.push('weekly_synthesis.sh');
  }
  
  return created;
}

module.exports = { setupTraderScripts };
