# 🦞 downrigger

Bootstrap a complete AI trading agent with safety governors, explainability, and continuous learning.

```bash
downrigger install trader
```

## What It Does

Sets up a trading agent workspace where:

- **Safety governors** override bad decisions (hard stops on drawdown, failures, RPC errors)
- **Every trade** generates an explainability snapshot (signals, rationale, exit conditions)
- **Learning happens** via daily recaps, weekly synthesis, and A/B strategy episodes
- **Personality is cosmetic** — voice changes how it writes, never what it trades
- **Preferences require confirmation** — captures hints from chat but pins nothing without approval

## Quick Start

```bash
# One command, 6 steps, ready to trade
downrigger install trader

# Verify it's healthy
downrigger doctor
```

Creates:
```
workspace/
├── core/                    # Identity, config, constitution
├── knowledge/
│   ├── pinned/             # Hard rules (risk limits, preferences)
│   ├── packs/              # Strategy/risk/execution patterns
│   └── candidates/         # Pending preferences (unconfirmed)
├── journal/
│   ├── decisions/          # Explainability snapshots (per trade)
│   └── recaps/             # Daily summaries
├── state/
│   ├── governor.json       # Kill switch
│   └── now.json            # Live status
├── episodes/               # A/B tests
└── suggestions/            # Proposed changes (need approval)
```

## Core Commands

| Command | Purpose |
|---------|---------|
| `downrigger install trader` | Full 6-step setup |
| `downrigger doctor` | 9-check health report |
| `downrigger reset --keep-wallet --force` | Clean slate (keeps wallet) |
| `downrigger voice set direct` | Blunt/calm/nerdy writing style |
| `downrigger preferences list` | Review captured preferences |
| `downrigger export-debug --last 24h` | Bundle logs/incidents for support |

## Safety System

### Hard Governor (`state/governor.json`)

Local kill switch checked before every trade. Auto-triggers on:
- 5 consecutive failures
- RPC error rate > 50%
- Drawdown exceeds limit
- Manual flag

### Risk Rules (`core/RISK_RULES.md`)

Hard constraints written in plain English:
- Max position size
- Max drawdown before stopping
- Max daily loss
- Which assets are allowed

### Constitution (`knowledge/pinned/CONSTITUTION.md`)

Non-negotiable rules confirmed by the user. Requires explicit approval to change.

## Explainability

Every trade decision creates a snapshot at `journal/decisions/YYYY-MM-DD/<intent_id>.md`:

```markdown
## Signals Triggered
- TrendFollowing: +0.7 confidence

## Sizing Rationale  
Calculated: $1500, Adjusted: $1200 (respects max_position_pct)

## Block Reasons
None - all checks passed

## Exit Conditions
- Stop-loss: -8%
- Time limit: 48h
```

The bot can answer: "Why did you make that trade?", "What changed?", "What did you learn?"

## Learning Loop

| When | What | Output |
|------|------|--------|
| Every trade | Decision snapshot | `journal/decisions/*.md` |
| Midnight | Daily recap | `journal/recaps/YYYY-MM-DD.md` |
| Monday 9am | Weekly synthesis | Suggestions + episode recaps |
| Continuous | A/B episodes | `episodes/active.json` → `completed/` |

**Suggestions** appear in `suggestions/pending.json` with:
- Config diff
- Expected benefit + risk tradeoff
- Rollback plan
- One-tap approval (or ignore)

## Voice (Cosmetic Only)

Changes how the bot writes recaps and incidents. Never affects trading logic.

```bash
downrigger voice list    # direct, calm, nerdy
downrigger voice set direct
```

- **direct**: "Lost $45 on SOL. Stop was too tight. Widening to 8%."
- **calm**: "The SOL position closed with a $45 loss..."
- **nerdy**: "SOL/USDC long closed at -$45 PnL. Stop triggered at 1.2%..."

## Conversation Memory

Captures preference hints from chat but **requires explicit confirmation**:

```
User: "I never want to risk more than 3% per trade"
Bot:  [stores as candidate, 85% confidence]
      "Should I add this to your trading rules?"
User: "yes" → Pinned to CONSTITUTION
User: [ignore] → Stays pending, no behavior change
```

```bash
downrigger preferences list                    # View pending
downrigger preferences confirm <id>            # Approve
downrigger preferences reject <id>             # Discard
```

Prevents "LLM drift" — no silent behavior changes.

## Cron Jobs (5 total)

Minimal set for trading agents:

| Job | Frequency | Purpose |
|-----|-----------|---------|
| health_check | Every 3 min | Governor status, wallet connectivity |
| reconcile_now | Every 5 min | Holdings reconciliation backup |
| report_wallet | Daily 6am | Report address to control plane |
| daily_recap | Midnight | Generate trading summary |
| weekly_synthesis | Monday 9am | Weekly review + suggestions |

## Installation

```bash
git clone https://github.com/janebot2026/downrigger.git
cd downrigger
npm install
npm link  # optional
```

## Philosophy

- **Safety first**: Governors override everything
- **Explainability**: Every decision has a paper trail
- **Human-in-the-loop**: Suggestions need approval
- **Cosmetic personality**: Voice ≠ logic
- **No drift**: Preferences require confirmation

## License

MIT
