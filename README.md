# 🦞 downrigger

**Trading Agent Context Environment Bootstrap Tool**

Bootstraps a complete AI trading agent environment with safety-first architecture, explainability, and continuous learning.

## What's Downrigger

`downrigger` is **not** a general-purpose agent tool. It's a specialized bootstrapper for **trading agents** that:

- Keeps personality separate from execution (voice layer)
- Requires human confirmation for behavior changes (conversation memory)
- Has hard safety governors that override everything
- Generates explainability snapshots for every decision
- Learns from trades without drifting from core principles

Think of it as the scaffolding for an "always-on trader that can explain itself."

## Installation

```bash
# Clone
git clone https://github.com/janebot2026/downrigger.git
cd downrigger

# Install
npm install

# Link globally (optional)
npm link
```

## Quick Start: Trading Environment

```bash
# Full trading setup in one command (6 steps)
downrigger install trader

# Or specify directory
downrigger install trader -d /opt/trading-agent
```

This creates a trading-optimized workspace:

```
~/.openclaw/workspace/
├── core/                    # Identity and constitution
│   ├── MEMORY.md           # Long-term knowledge
│   ├── SOUL.md             # Core identity
│   ├── USER.md             # Stakeholder info
│   ├── AGENTS.md           # Operating guide
│   ├── TRADING_CONFIG.md   # Risk limits, strategy settings
│   ├── RISK_RULES.md       # Hard safety constraints
│   ├── STRATEGIES.md       # Strategy definitions
│   ├── CONSTITUTION.md     # Non-negotiable rules
│   └── VOICE.md            # Personality (cosmetic only)
│
├── knowledge/              # Curated knowledge
│   ├── pinned/            # Immutable rules (CONSTITUTION.md)
│   ├── packs/             # Strategy/risk/execution best practices
│   ├── entities/          # Token/venue metadata
│   ├── tacit/             # Learned patterns (this bot only)
│   └── candidates/        # Pending user preferences (unconfirmed)
│
├── journal/               # Structured trading history
│   ├── trades/           # Individual trade records
│   ├── decisions/        # Explainability snapshots (per intent_id)
│   └── recaps/           # Daily summaries
│
├── episodes/             # A/B strategy tests
│   ├── active.json       # Current experiment
│   └── completed/        # Past experiments
│
├── state/                # Runtime state (read-only snapshots)
│   ├── now.json          # Live status
│   ├── portfolio_snapshot.json
│   ├── governor.json     # Hard kill switch
│   └── wallet/           # Wallet snapshots (no keys)
│
├── reports/              # Analysis output
│   ├── daily_pnl/        # Daily PnL reports
│   └── incidents/        # Incident autopsies
│
├── suggestions/          # Proposed changes (human approval required)
│   └── pending.json      # Queue of suggestions with diffs
│
└── scripts/              # Trading-specific automation
    ├── health_check.sh
    ├── reconcile_now.sh
    ├── report_wallet.sh
    ├── daily_recap.sh
    └── weekly_synthesis.sh
```

## Commands

### `install trader` — Full Trading Setup

The primary command. Sets up everything needed for a trading agent:

```bash
downrigger install trader [options]

Options:
  -d, --dir <path>      Target directory (default: ~/.openclaw/workspace)
  --force               Overwrite existing files
  --agent-name <name>   Agent name (default: Jane)
  --owner-name <name>   Owner/stakeholder name (default: Owner)
```

**6-Step Setup Process:**
1. ✅ Directory structure (core/, knowledge/, journal/, state/, reports/)
2. ✅ Core files (MEMORY.md, SOUL.md, TRADING_CONFIG.md, etc.)
3. ✅ Wallet setup (generates or prompts for keypair)
4. ✅ Trading templates (RISK_RULES.md, STRATEGIES.md, CONSTITUTION.md)
5. ✅ Cron jobs (5 trading-specific jobs)
6. ✅ Green lights report (health check output)

### `doctor` — Health Check

```bash
# Run 9-check health report
downrigger doctor

# Example output:
# 🩺 Downrigger Health Check
# ✅ Wallet exists
# ✅ Journal structure
# ✅ State files
# ✅ Governor file
# ✅ Core templates
# ✅ Explainability enabled
# ✅ Voice configured
# ✅ Conversation memory
# ✅ Cron jobs
#
# 🟢 All systems green. Ready to trade.
```

### `reset` — Clean Slate

```bash
# Reset everything except wallet
downrigger reset --keep-wallet --force

# Full reset (⚠️ destroys wallet)
downrigger reset --force
```

Preserves: core/MEMORY.md, core/SOUL.md, knowledge/pinned/CONSTITUTION.md
Clears: journal/, state/, reports/, suggestions/, episodes/

### `export-debug` — Support Bundle

```bash
# Export last 24h of logs/configs/incidents
downrigger export-debug --last 24h

# Custom time window
downrigger export-debug --last 48h -o /tmp/debug-bundle.tar.gz
```

Creates tarball with:
- Logs (scrubbed of keys)
- Configs (TRADING_CONFIG.md, RISK_RULES.md)
- Incidents (last N hours)
- Snapshots (portfolio, state, wallet address)
- Events (trades, decisions, recaps)

### `voice` — Personality (Cosmetic Only)

```bash
# List voice options
downrigger voice list

# Show current voice
downrigger voice show

# Set voice
downrigger voice set direct    # Blunt, concise (default)
downrigger voice set calm      # Measured, reassuring
downrigger voice set nerdy     # Technical, precise
```

**Important:** Voice changes how the bot writes recaps and incidents. It **never** changes trading logic, position sizes, or risk limits.

### `preferences` — Conversation Memory

```bash
# List pending preference candidates
downrigger preferences list

# Confirm and pin to CONSTITUTION
downrigger preferences confirm <id>

# Reject candidate
downrigger preferences reject <id> --reason "too vague"
```

Captures user preferences from chat (risk tolerance, strategy preferences, etc.) but **requires explicit confirmation** before becoming active. Prevents "LLM drift."

### `template` — Generate Files

```bash
# List available templates
downrigger template --list

# Generate a file
downrigger template RISK_RULES.md -o core/
downrigger template TRADE_TEMPLATE.md -o journal/trades/
downrigger template CONSTITUTION.md -o knowledge/pinned/
```

**Available templates:**
- Core: `MEMORY.md`, `SOUL.md`, `USER.md`, `AGENTS.md`, `TRADING_CONFIG.md`, `VOICE.md`
- Trading: `RISK_RULES.md`, `STRATEGIES.md`, `CONSTITUTION.md`
- Journal: `TRADE_TEMPLATE.md`, `DAILY_TEMPLATE.md`, `INCIDENT_TEMPLATE.md`, `DECISION_TEMPLATE.md`
- Episodes: `EPISODE_RECAP_TEMPLATE.md`
- Suggestions: `SUGGESTION_JSON`, `CANDIDATES_PREFERENCES_JSON`

## Core Features

### 1. Voice Layer (Cosmetic Only)

**Principle:** Voice affects explanations. Trading logic stays deterministic.

The bot can write in three voices:
- **direct**: "Lost $45 on SOL. Stop was too tight. Widening to 8%."
- **calm**: "The SOL position closed with a $45 loss. The stop-loss trigger was within expected parameters..."
- **nerdy**: "SOL/USDC long closed at -$45 PnL. Stop-loss triggered at 1.2% adverse move (vs 1.5% avg volatility)..."

Where voice applies:
- ✅ journal/recaps/*.md
- ✅ journal/decisions/*.md (rationale section)
- ✅ reports/incidents/*.md
- ✅ suggestions/pending.json

Where voice **never** applies:
- ❌ Config files (.toml, .json)
- ❌ Trading logic
- ❌ Risk calculations
- ❌ Position sizing
- ❌ Raw trade data

### 2. Conversation Memory (Requires Confirmation)

**Prevents LLM drift.** The bot captures potential preferences from chat but stores them as **unconfirmed candidates** until explicitly approved.

**Example:**
```
User: "I never want to risk more than 3% on a single trade"

Bot: [detects pattern, stores candidate with 85% confidence]
      "I noted you want max 3% risk per trade. Should I add this to your trading rules?"

User: "yes"
Bot: [confirms, adds to CONSTITUTION.md]

User: [ignores]
Bot: [candidate stays pending, no behavior change]
```

**Detected patterns:**
- Risk tolerance ("keep drawdown under 5%")
- Strategy preferences ("prefer trend trading")
- Schedule constraints ("don't trade overnight")
- Notification preferences ("alert me when...")
- Position limits ("max 3 positions")

### 3. Hard Safety Governor

A local file-based kill switch that overrides **everything**:

`state/governor.json`:
```json
{
  "active": false,
  "triggered_at": null,
  "reason": null,
  "conditions": {
    "repeated_failures": 0,
    "rpc_error_rate": 0.0,
    "drawdown_pct": 0.0,
    "shield_flags": []
  }
}
```

**Automatic triggers:**
- 5 consecutive trade failures
- RPC error rate > 50%
- Drawdown exceeds max_drawdown_pct
- Shield flags (manual safety triggers)

**Manual override:**
```bash
# Edit state/governor.json, set active: true
# All trading stops immediately
```

Checked before every quote/swap operation.

### 4. Explainability Snapshots

Every trade decision generates a full explanation:

`journal/decisions/2026-02-05/<intent_id>.md`:
```markdown
# Trade Decision: intent-uuid-here

## Signals Triggered
- TrendFollowing: +0.7 confidence
- VolumeSpike: +0.3 confidence

## Sizing Rationale
Calculated: $1500 (5% of portfolio)
Adjusted: $1200 (respects max_position_pct)

## Block Reasons
None - all checks passed

## Exit Conditions
- Stop-loss: -8%
- Take-profit: +20%
- Time limit: 48h

## Invalidators
- Break below $1.20 support
- Volume drops below 20-period average

## Confidence Levels
- Signal: 0.72
- Execution: 0.95
- Overall: 0.68
```

**What the bot can answer:**
1. "What are you doing now?" → Check state/now.json
2. "Why did you make that trade?" → Check journal/decisions/<intent_id>.md
3. "What changed recently?" → Check state/now.json (recent_changes)
4. "What did you learn?" → Check journal/recaps/ and knowledge/tacit/
5. "How's the A/B test going?" → Check episodes/active.json

### 5. A/B Strategy Episodes

Time-boxed experiments with clear success metrics:

`episodes/active.json`:
```json
{
  "episode_id": "ep-001",
  "hypothesis": "Wider stops reduce whipsaws in volatile markets",
  "baseline_config": { "stop_loss_pct": 5 },
  "test_config": { "stop_loss_pct": 8 },
  "start_time": "2026-02-01T00:00:00Z",
  "duration_days": 7,
  "success_metrics": {
    "total_pnl": 0,
    "max_drawdown_pct": 0,
    "win_rate": 0,
    "avg_hold_time_hours": 0
  },
  "recommendation": null
}
```

**End-of-episode decision:** Keep / Revert / Adjust

### 6. Continuous Learning Loop

**Daily Recap** (midnight):
- Template generated at 11:55pm
- Agent fills at midnight
- Includes: trades made, lessons learned, config changes, suggestions

**Weekly Synthesis** (Monday 9am):
- Reviews week's trades
- Identifies patterns
- Generates suggestions for improvement

**Suggestion Queue** (human approval):
- Auto-generated proposals appear in `suggestions/pending.json`
- Each includes: config diff, expected benefit, risk tradeoff, rollback plan
- One-tap approval via control plane (or manual edit)

## OpenClaw Cron (Trading-Specific)

Minimal cron set designed for trading, not general automation:

| Job | Schedule | Purpose |
|-----|----------|---------|
| health_check | Every 3 min | Check governor, wallet connectivity, system status |
| reconcile_now | Every 5 min | Backup reconciliation of on-chain holdings |
| report_wallet | Daily 6am | Report wallet address to control plane |
| daily_recap | Midnight | Generate daily trading summary |
| weekly_synthesis | Monday 9am | Weekly review and suggestion generation |

**NOT included** (trading agents don't need):
- Git workspace sweeps
- Nightly improvement jobs
- Cost savings searcher
- General research tasks

## Trading vs General Agent

| Feature | General Agent | Downrigger (Trading) |
|---------|--------------|---------------------|
| Directory structure | Projects/Areas/Resources/Archives | core/knowledge/journal/state/reports |
| Voice | N/A | 3 options (direct/calm/nerdy) |
| Safety governor | N/A | Hard kill switch |
| Explainability | N/A | Per-decision snapshots |
| Conversation memory | Direct learning | Requires confirmation |
| A/B testing | N/A | Strategy episodes |
| Cron jobs | 10+ general tasks | 5 trading-specific |
| QMD search | Yes | Removed (trading agents don't need semantic search) |
| Git automation | Yes | Removed (state lives in control plane) |

## Philosophy

1. **Safety First**: Hard governors, explicit confirmations, no silent drift
2. **Explainability**: Every decision has a paper trail
3. **Human-in-the-Loop**: Suggestions require approval, preferences need confirmation
4. **Separation of Concerns**: Voice ≠ Logic, Memory ≠ Behavior
5. **Trading-Focused**: Remove general-agent cruft, keep what traders need

## Troubleshooting

### Wallet not found
```bash
# Check wallet path in TRADING_CONFIG.md
cat core/TRADING_CONFIG.md | grep wallet

# Regenerate if needed (will prompt for confirmation)
downrigger reset --keep-wallet --force
downrigger install trader
```

### Governor triggered unexpectedly
```bash
# Check governor status
cat state/governor.json

# Manual reset (if you're sure it's safe)
# Edit state/governor.json: set "active": false
```

### Preferences not being captured
```bash
# Check if auto-capture is enabled
cat knowledge/candidates/preferences.json | grep auto_capture

# Check pending candidates
downrigger preferences list
```

### Explainability snapshots missing
```bash
# Check if journal/decisions/ directory exists
ls -la journal/decisions/

# Verify explainability is enabled in config
grep -i explainability core/TRADING_CONFIG.md
```

## Migration from General-Purpose Agent

If you have an existing janebot-cli/downrigger v2.x setup:

1. **Backup your workspace**
   ```bash
   cp -r ~/.openclaw/workspace ~/.openclaw/workspace-backup
   ```

2. **Install new downrigger**
   ```bash
   cd /path/to/downrigger
   git pull
   npm install
   npm link
   ```

3. **Reset to trading structure**
   ```bash
   downrigger reset --keep-wallet --force
   downrigger install trader
   ```

4. **Port your pinned rules**
   ```bash
   # Copy key rules from old knowledge/areas/ to new knowledge/pinned/CONSTITUTION.md
   ```

## License

MIT

---

*Built for traders who want agents that can explain themselves.*
