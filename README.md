# 🦞 downrigger

**North star:** Always-on trader that can explain itself.

## What That Means

Anytime, the bot can answer:

| Question | Where to look |
|----------|---------------|
| What are you doing now? | `state/now.json` |
| What changed recently? | `state/now.json` → `recent_changes` |
| What did you learn? | `journal/recaps/` + `knowledge/tacit/` |
| What do you recommend? | `suggestions/pending.json` |

## Quick Start

```bash
downrigger install trader    # 6 steps, ready to trade
downrigger doctor            # Verify green lights
```

## The Core (5 Things)

### 1. Directory Structure

```
workspace/
├── core/                 # MEMORY, SOUL, TRADING_CONFIG, RISK_RULES
├── knowledge/
│   ├── pinned/          # CONSTITUTION (non-negotiable rules)
│   ├── packs/           # Strategy/risk/execution patterns
│   └── tacit/           # Learned by THIS bot
├── journal/
│   ├── trades/          # Trade records
│   ├── decisions/       # Explainability per intent
│   └── recaps/          # Daily summaries
├── state/
│   ├── now.json         # Live status (one-file truth)
│   └── portfolio.json   # Holdings snapshot
├── episodes/            # A/B strategy tests
└── suggestions/         # Proposed changes (need approval)
```

### 2. Files Generated

**Identity:**
- `core/MEMORY.md` — Long-term knowledge
- `core/SOUL.md` — Core identity  
- `core/USER.md` — Stakeholder info

**Trading Brain:**
- `core/TRADING_CONFIG.md` — Risk limits, strategy settings
- `core/RISK_RULES.md` — Hard safety constraints
- `core/STRATEGIES.md` — Strategy definitions
- `knowledge/pinned/CONSTITUTION.md` — Non-negotiable rules

**Templates:**
- `journal/decisions/` → 2-5 bullet explainability per trade
- `journal/recaps/` → Daily summary format
- `reports/incidents/` → Autopsy template

### 3. Continuous Learning Loop

| Frequency | Action | Output |
|-----------|--------|--------|
| Every trade | Write decision snapshot | `journal/decisions/<intent_id>.md` |
| Midnight | Generate daily recap | `journal/recaps/YYYY-MM-DD.md` |
| Monday 9am | Weekly synthesis | Suggestions + episode reviews |
| Post-episode | Evaluate A/B test | `episodes/completed/` + recommendation |

### 4. Cron Jobs (5 Total)

```
health_check      every 3 min   Governor status, connectivity
reconcile_now     every 5 min   Holdings reconciliation backup
report_wallet     daily 6am     Report address to control plane
daily_recap       midnight      Generate trading summary
weekly_synthesis  mon 9am       Weekly review + suggestions
```

### 5. Installer CLI (`downrigger`)

**Commands:**
- `install trader` — Full 6-step setup
- `doctor` — 9-check health report
- `reset --keep-wallet` — Clean slate
- `voice set direct|calm|nerdy` — Cosmetic personality
- `preferences list|confirm|reject` — Manage captured preferences
- `export-debug --last 24h` — Bundle for support

**6-step install process:**
1. Directory structure
2. Core files
3. Wallet setup
4. Trading templates
5. Cron jobs
6. Green lights report

## Improvements on Top

### Live Status (`state/now.json`)

One-file truth for "what are you doing now":
```json
{
  "mode": "paper",
  "current_focus": "Scanning SOL/USDC",
  "last_decision": "intent-abc-123",
  "next_check_in": "2026-02-05T12:00:00Z",
  "recent_changes": ["widened stop to 8%"],
  "active_constraints": ["max_drawdown: 10%"],
  "session_stats": { "trades_today": 3, "pnl": -45 }
}
```

### Explainability Snapshots

Every intent gets 2-5 bullets:
```markdown
## Decision: intent-abc-123
- **Signals:** TrendFollowing +0.7, VolumeSpike +0.3
- **Rationale:** $1500 → $1200 (respects max_position_pct)
- **Blocked:** No — all checks passed
- **Exit:** Stop -8%, Target +20%, Time 48h
- **Confidence:** Signal 0.72, Execution 0.95
```

### A/B Strategy Episodes

Time-boxed experiments with metrics:
```json
{
  "hypothesis": "Wider stops reduce whipsaws",
  "baseline": { "stop_loss_pct": 5 },
  "test": { "stop_loss_pct": 8 },
  "duration_days": 7,
  "metrics": { "pnl": 0, "drawdown": 0, "win_rate": 0 }
}
```

End-of-episode: Keep / Revert / Adjust

### Suggestion Queue

Auto-generated, human-approved:
```json
{
  "description": "Increase stop_loss_pct 5% → 8%",
  "config_diff": { "stop_loss_pct": { "old": 5, "new": 8 } },
  "expected_benefit": "Fewer whipsaws in volatile markets",
  "risk_tradeoff": "Larger individual losses",
  "confidence": 0.72,
  "rollback_plan": "Revert to 5% if drawdown > 10%"
}
```

One-tap approval via control plane.

### Incident Autopsy Mode

Auto-generated when things go wrong:
```markdown
## Incident: RPC_TIMEOUT_2026-02-05
- **Symptom:** Trade submission timeout after 10s
- **Impact:** 1 trade failed, $0 lost
- **Bot Actions:** Retried 3x, paused 2min
- **Recommended Fix:** Increase confirm_timeout_secs to 15
```

### Hard Safety Governor

Local kill switch (`state/governor.json`):
- Auto-triggers: 5 failures, RPC errors > 50%, drawdown exceeded
- Checked before every quote/swap
- Manual override: edit file, set `active: true`

### Wallet Hygiene

- Periodic wallet snapshots (address only, no keys)
- `export-debug` bundles: logs, configs, incidents, snapshots
- No secrets in exported bundles

### Voice Layer (Cosmetic Only)

```bash
downrigger voice set direct   # "Lost $45. Stop too tight. Widening to 8%."
downrigger voice set calm     # "The position closed with a $45 loss..."
downrigger voice set nerdy    # "SOL/USDC closed at -$45 PnL. Stop at 1.2%..."
```

Changes how it writes. Never changes what it trades.

### Conversation Memory (Trading-Only)

Captures hints, requires confirmation:
```
User: "I never risk more than 3% per trade"
Bot:  [stores candidate]
      "Should I add this to your rules?"
User: "yes" → Pinned to CONSTITUTION
User: [ignore] → No behavior change
```

```bash
downrigger preferences confirm <id>   # Approve
downrigger preferences reject <id>    # Discard
```

Prevents LLM drift.

## Philosophy

- **Explainability over black box** — Every decision has a paper trail
- **Safety over speed** — Governors override everything
- **Human-in-the-loop** — Suggestions need approval
- **No silent drift** — Preferences require confirmation

## License

MIT
