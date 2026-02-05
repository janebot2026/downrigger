# 🦞 downrigger

Bootstrap a complete AI agent context environment with PKM (Personal Knowledge Management), QMD search, and OpenClaw-native automation.

## What's New in v2.0

- **OpenClaw Native Cron** — Uses OpenClaw's internal `jobs.json` instead of system crontab
- **Two Job Types** — `systemEvent` for lightweight logging, `agentTurn` for actual agent work
- **Time Sync Fix** — Single-file overwrite instead of memory bloat
- **New Scripts** — Env snapshot, models/cron check, and more
- **Better Scheduling** — Staggered times to avoid conflicts
- **Safer Defaults** — Potentially risky automation is opt-in

## What It Does

`downrigger` sets up a full context environment for persistent AI agents:

- **PARA Structure** — Projects, Areas, Resources, Archives organization
- **QMD Search** — Fast full-text + semantic search over your knowledge base
- **Atomic Facts** — Structured entity memory with relationships and history
- **Memory Decay** — Hot/Warm/Cold tiers keep context windows lean
- **OpenClaw Cron** — Native automation with two job types:
  - `systemEvent`: Lightweight script execution (logging, monitoring)
  - `agentTurn`: Full agent sessions that can analyze and improve
- **Templates** — Built-in templates for MEMORY.md, SOUL.md, AGENTS.md, etc.

## Installation

```bash
# Clone or download
git clone https://github.com/janebot2026/downrigger.git
cd downrigger

# Install dependencies
npm install

# Link globally (optional)
npm link
```

## Quick Start

```bash
# Full setup in one command
downrigger init

# Or with options
downrigger init -d ~/my-agent --yes
```

This creates (in your OpenClaw workspace):
```
~/.openclaw/workspace/
├── knowledge/          # PARA structure
│   ├── projects/       # Active work
│   ├── areas/          # Ongoing responsibilities
│   │   └── people/     # Entity knowledge
│   ├── resources/      # Reference material
│   ├── archives/       # Inactive items
│   ├── tacit/          # Operational patterns
│   └── schema/         # Atomic facts schema
├── memory/             # Daily notes
├── scripts/            # Automation scripts
│   ├── qmd.sh          # Search wrapper
│   ├── weekly-synthesis.sh
│   ├── log_datetime.sh      # Time sync (state file)
│   ├── log_env_snapshot.sh  # System monitoring
│   └── git_workspace_sweep.sh
├── .local/state/       # State files (time-sync, etc)
├── tasks/              # Task tracking
├── research/           # Research topics
├── MEMORY.md           # Long-term knowledge
├── SOUL.md             # Core identity
├── USER.md             # Stakeholder info
└── AGENTS.md           # Operating guide
```

## Commands

### `init` — Full Bootstrap

```bash
downrigger init [options]

Options:
  -d, --dir <path>    Target directory (default: ~/.openclaw/workspace or ~/.openclaw/workspace-<profile>)
  --skip-qmd          Skip QMD installation
  --skip-cron         Skip cron job setup
  --skip-git          Skip git initialization
  -y, --yes           Accept all defaults
  --dry-run           Preview changes without making them
  --force             Overwrite existing files
  --agent-name <name> Agent name (default: Jane)
  --owner-name <name> Owner/stakeholder name (default: Owner)
```

### `install` — Component-Specific

```bash
# Install everything (for fresh DigitalOcean droplets)
downrigger install all -d ~/workspace

# Install just the PKM structure
downrigger install pkm

# Install just QMD
downrigger install qmd

# Install just scripts
downrigger install scripts

# Install development tools (Node, Rust, Python)
downrigger install devtools

 # Install just cron jobs
 downrigger install cron

 # Install heartbeat support
 downrigger install heartbeat
 ```

### `verify` — Health Check

```bash
# Check environment integrity
downrigger verify

# Auto-fix issues
downrigger verify --fix
```

### `doctor` — Diagnostics

```bash
# Full health report
downrigger doctor
```

### `sync` — Manual Sync

```bash
# Update QMD indexes, run synthesis, git sync
downrigger sync
```

### `template` — Generate Files

```bash
# List available templates
downrigger template --list

# Generate a file
downrigger template MEMORY.md -o MEMORY.md
downrigger template SOUL.md -o SOUL.md
```

## OpenClaw Cron System

Unlike traditional cron, downrigger uses OpenClaw's native cron system (`~/.openclaw/cron/jobs.json`).

Note: OpenClaw docs recommend using `openclaw cron add/edit` for changes. Manual edits to `~/.openclaw/cron/jobs.json` are only safe when the Gateway is stopped.

### Two Job Types

| Type | Purpose | Duration | Examples |
|------|---------|----------|----------|
| `systemEvent` | Run scripts directly | Milliseconds | Time sync, env snapshot, git sweep |
| `agentTurn` | Create agent session | Minutes-hours | Nightly improvement, bug sweep |

### Default Cron Jobs

| Job | Type | Schedule | Description |
|-----|------|----------|-------------|
| Weekly Synthesis | `agentTurn` (isolated) | 0 9 * * 1 | Apply memory decay + regenerate entity summaries |
| Daily Memory | `agentTurn` | 55 23 * * * | Summarize day's memory file |
| Nightly Improvement | `agentTurn` | 15 22 * * * | Analyze logs, ship one improvement |
| Cost Savings | `agentTurn` | 15 23 * * * | Find token optimization opportunities |
| Weekly Bug Sweep | `agentTurn` | 30 9 * * 1 | **Disabled by default.** Review bugs, update prevention rules |
| Weekly Experiments | `agentTurn` | 0 9 * * 1 | **Disabled by default.** Evaluate experiments, update rules |

### Safety Defaults

- Cron jobs run agent turns (model calls). Avoid very frequent schedules.
- Periodic “awareness” work belongs in `HEARTBEAT.md` per OpenClaw docs.

### Why Staggered Times?

Jobs are intentionally offset to avoid pile-ups:
- 22:00 — Moltbook Activity (isolated session)
- 22:15 — Nightly Improvement (isolated session) ← 15 min gap
- 23:15 — Cost Savings (isolated session)
- 23:55 — Daily Memory Distill (main session)

### Managing Cron Jobs

```bash
# List all cron jobs
openclaw cron list

# View next runs
openclaw cron list --next

# Get job details
openclaw cron get <job-id>

# Enable/disable a job
openclaw cron disable <job-id>
openclaw cron enable <job-id>

# Restart gateway (required after cron changes)
openclaw gateway restart
```

## How It Works

### PKM System (PARA)

Based on [Tiago Forte's PARA method](https://fortelabs.com/blog/para/):

- **Projects** — Active work with clear goals/deadlines
- **Areas** — Ongoing responsibilities (no end date)
- **Resources** — Reference material
- **Archives** — Inactive items (never deleted, just moved)

### Atomic Facts

Each entity (person, company, project) has:
- `items.json` — Array of atomic facts with schema
- `summary.md` — Auto-generated from Hot/Warm facts

Fact schema:
```json
{
  "id": "conor-001",
  "fact": "Primary stakeholder",
  "category": "relationship",
  "timestamp": "2026-02-01",
  "status": "active",
  "supersededBy": null,
  "lastAccessed": "2026-02-01",
  "accessCount": 5
}
```

### Memory Decay

Facts are tiered by recency:
- **Hot** — Accessed within 7 days (prominently featured)
- **Warm** — Accessed 8-30 days ago (lower priority)
- **Cold** — 30+ days ago (omitted from summary, still searchable)

High access counts resist decay (5+ = +3 days, 10+ = +7 days).

### QMD Search

[QMD](https://github.com/tobi/qmd) provides:
- BM25 full-text search
- Vector semantic search
- Hybrid query with re-ranking

Usage:
```bash
./scripts/qmd.sh search "continuous improvement"
./scripts/qmd.sh query "natural language search"
./scripts/qmd.sh get "areas/people/conor/summary.md"
```

Notes:
- QMD is vendored into your workspace at `./.tools/qmd`.
- `bun` must be installed before running `downrigger install qmd`.

## Migration from v1.x

If you have an existing downrigger v1.x setup:

1. **Backup your current setup**
   ```bash
   cp -r ~/clawd ~/clawd-backup
   ```

2. **Update the CLI**
   ```bash
   cd /path/to/downrigger
   git pull
   npm install
   ```

3. **Update scripts only (preserves your memory files)**
   ```bash
   downrigger install scripts --force
   downrigger install cron --force
   ```

4. **Fix time-sync bloat**
   ```bash
   # Old: appends to memory/YYYY-MM-DD.md
   # New: overwrites ~/.local/state/clawdbot/time-sync.txt
   ```

5. **Restart OpenClaw**
   ```bash
   openclaw gateway restart
   ```

## Troubleshooting

### Cron jobs not running

1. Check OpenClaw gateway is running:
   ```bash
   openclaw gateway status
   ```

2. Verify jobs are loaded:
   ```bash
   openclaw cron list
   ```

3. Check job logs:
   ```bash
    openclaw cron logs <job-id>
    ```

### Gateway logs

Tail logs (recommended):

```bash
openclaw logs --follow
```

Default log file location:

- `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

### Time sync not updating

Check the state file:
```bash
cat ~/.local/state/clawdbot/time-sync.txt
```

Should show a single ISO-8601 timestamp.

### QMD search not working

Rebuild the index:
```bash
./scripts/qmd.sh update
```

## Why This Exists

1. **Reproducibility** — Spin up identical environments for future coworkers
2. **Documentation** — Reference for "how this works"
3. **Best Practices** — Encodes lessons learned from running persistent agents
4. **OpenClaw Native** — Designed for OpenClaw's cron system, not legacy crontab

## License

MIT
