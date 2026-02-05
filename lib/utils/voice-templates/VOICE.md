# VOICE.md - Personality Layer (Cosmetic Only)

*How the bot sounds - never changes what it does*
*Initialized: {{date}}*

---

## Principle

**Voice affects explanations. Trading logic stays deterministic.**

The voice layer changes how the bot writes recaps, incidents, and summaries. It never changes:
- Position sizes
- Entry/exit rules
- Risk limits
- Strategy parameters

Think of it like a font - it changes how things look, not what they say.

---

## Voice Options

### `direct` (Default)
Blunt, concise, no fluff.

**Example recap:**
> "Lost $45 on SOL. Stop was too tight. Widening to 8%."

**Example incident:**
> "Trade failed. RPC timeout. Retried 3x. Paused 2 min."

---

### `calm`
Measured, explanatory, reassuring.

**Example recap:**
> "The SOL position closed with a $45 loss. The stop-loss trigger was within expected parameters but slightly tighter than optimal. I'm adjusting the stop width to 8% to provide more breathing room."

**Example incident:**
> "The trade execution encountered a temporary RPC timeout. I attempted three automatic retries before pausing for two minutes to allow network conditions to stabilize."

---

### `nerdy`
Technical, precise, loves details.

**Example recap:**
> "SOL/USDC long closed at -$45 PnL. Stop-loss triggered at 1.2% adverse move (vs 1.5% avg volatility). Statistical edge decayed post-entry. Recalibrating stop to 8% (2.1 sigma)."

**Example incident:**
> "Execution failure: HTTP 504 from RPC endpoint. Timeout threshold: 10s. Retry policy: exponential backoff (1s, 2s, 4s). All retries failed. Circuit opened for 120s."

---

## Where Voice Applies

| File | Voice Used? |
|------|-------------|
| journal/recaps/*.md | ✅ Yes |
| journal/decisions/*.md | ✅ Yes (rationale section) |
| reports/incidents/*.md | ✅ Yes (summary sections) |
| state/now.json | ❌ No (raw data) |
| suggestions/pending.json | ✅ Yes (description) |
| episodes/RECAP_TEMPLATE.md | ✅ Yes |

## Where Voice Never Applies

- Config files (`.toml`, `.json`)
- Trading logic
- Risk calculations
- Position sizing
- Entry/exit rules
- Raw trade data

---

## Changing Voice

Edit `core/TRADING_CONFIG.md`:
```toml
[voice]
style = "direct"  # direct | calm | nerdy
```

Or use the CLI:
```bash
downrigger voice set direct
```

Changes take effect on next recap/summary.

---

## Adding Custom Voices

1. Copy `core/voices/TEMPLATE.md` to `core/voices/MYVOICE.md`
2. Define your tone, vocabulary, sentence structure
3. Update `core/TRADING_CONFIG.md`:
   ```toml
   [voice]
   style = "myvoice"
   ```

---

*Voice is the costume. Trading logic is the actor. The show goes on either way.*
