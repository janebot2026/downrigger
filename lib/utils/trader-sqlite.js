const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function setupTraderSQLite(targetDir, options = {}) {
  const { force = false } = options;
  const scriptsDir = path.join(targetDir, 'scripts');
  await fs.ensureDir(scriptsDir);
  
  // Ensure .local/clawdbot directory exists
  const localDir = path.join(os.homedir(), '.local', 'clawdbot');
  await fs.ensureDir(localDir);
  
  const created = [];
  
  // Error tracking script (same as janebot-cli)
  const errorsDbScript = `#!/usr/bin/env python3
"""
Error/Incident Tracking Database
For trading agents - track API failures, slippage issues, etc.
"""

import sqlite3
import sys
import os
import re

DB_PATH = os.path.expanduser("~/.local/clawdbot/errors.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            error_type TEXT NOT NULL,
            component TEXT,
            message TEXT NOT NULL,
            root_cause TEXT,
            fix TEXT,
            status TEXT DEFAULT 'open',
            severity TEXT DEFAULT 'medium',
            recurrence_count INTEGER DEFAULT 1
        )
    ''')
    
    c.execute('CREATE INDEX IF NOT EXISTS idx_errors_type ON errors(error_type)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_errors_status ON errors(status)')
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

def add_error(error_type, message, component=None, severity='medium'):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO errors (error_type, component, message, severity)
        VALUES (?, ?, ?, ?)
    ''', (error_type, component, message, severity))
    error_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"Error added with ID: {error_id}")

def list_errors(limit=20):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, timestamp, error_type, component, message, status FROM errors ORDER BY timestamp DESC LIMIT ?', (limit,))
    rows = c.fetchall()
    conn.close()
    
    for row in rows:
        print(f"[{row[0]}] {row[1]} [{row[2]}] {row[4][:50]}...")

def stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM errors')
    total = c.fetchone()[0]
    c.execute('SELECT COUNT(*) FROM errors WHERE status = "open"')
    open_count = c.fetchone()[0]
    conn.close()
    print(f"Errors: {total} total, {open_count} open")

def main():
    if len(sys.argv) < 2:
        print("Usage: errors-db.py [init|add|list|stats] ...")
        sys.exit(1)
    
    cmd = sys.argv[1]
    if cmd == 'init':
        init_db()
    elif cmd == 'add':
        if len(sys.argv) < 4:
            print("Usage: errors-db.py add <type> <message> [component]")
            sys.exit(1)
        add_error(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    elif cmd == 'list':
        list_errors()
    elif cmd == 'stats':
        stats()

if __name__ == '__main__':
    main()
`;

  const errorsDbPath = path.join(scriptsDir, 'errors-db.py');
  if (!await fs.pathExists(errorsDbPath) || force) {
    await fs.writeFile(errorsDbPath, errorsDbScript);
    await fs.chmod(errorsDbPath, 0o755);
    created.push('errors-db.py');
  }
  
  const errorsWrapper = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
python3 "\${SCRIPT_DIR}/errors-db.py" "$@"
`;

  const errorsShPath = path.join(scriptsDir, 'errors.sh');
  if (!await fs.pathExists(errorsShPath) || force) {
    await fs.writeFile(errorsShPath, errorsWrapper);
    await fs.chmod(errorsShPath, 0o755);
    created.push('errors.sh');
  }
  
  // Task queue script
  const tasksDbScript = `#!/usr/bin/env python3
"""
Task Queue System
For trading workflows and operational tasks.
"""

import sqlite3
import sys
import os

DB_PATH = os.path.expanduser("~/.local/clawdbot/tasks.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            title TEXT NOT NULL,
            description TEXT,
            project TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            blocker_reason TEXT,
            due_date TEXT,
            estimated_hours REAL
        )
    ''')
    
    c.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)')
    conn.commit()
    conn.close()

def add_task(title, **kwargs):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO tasks (title, description, project, priority, due_date, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (title, kwargs.get('description'), kwargs.get('project'), 
          kwargs.get('priority', 'medium'), kwargs.get('due_date'), 
          kwargs.get('estimated_hours')))
    task_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"Task added with ID: {task_id}")

def list_tasks(status=None, limit=20):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    query = 'SELECT id, created_at, title, project, priority, status FROM tasks'
    params = []
    if status:
        query += ' WHERE status = ?'
        params.append(status)
    query += ' ORDER BY priority DESC LIMIT ?'
    params.append(limit)
    
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    
    for row in rows:
        print(f"[{row[0]}] [{row[4]}] {row[2]} ({row[5]})")

def stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM tasks')
    total = c.fetchone()[0]
    c.execute('SELECT COUNT(*) FROM tasks WHERE status = "pending"')
    pending = c.fetchone()[0]
    conn.close()
    print(f"Tasks: {total} total, {pending} pending")

def main():
    if len(sys.argv) < 2:
        print("Usage: tasks-db.py [init|add|list|stats]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    if cmd == 'init':
        init_db()
    elif cmd == 'add':
        add_task(sys.argv[2] if len(sys.argv) > 2 else "Untitled")
    elif cmd == 'list':
        list_tasks()
    elif cmd == 'stats':
        stats()

if __name__ == '__main__':
    main()
`;

  const tasksDbPath = path.join(scriptsDir, 'tasks-db.py');
  if (!await fs.pathExists(tasksDbPath) || force) {
    await fs.writeFile(tasksDbPath, tasksDbScript);
    await fs.chmod(tasksDbPath, 0o755);
    created.push('tasks-db.py');
  }
  
  const tasksWrapper = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
python3 "\${SCRIPT_DIR}/tasks-db.py" "$@"
`;

  const tasksShPath = path.join(scriptsDir, 'tasks.sh');
  if (!await fs.pathExists(tasksShPath) || force) {
    await fs.writeFile(tasksShPath, tasksWrapper);
    await fs.chmod(tasksShPath, 0o755);
    created.push('tasks.sh');
  }
  
  // TRADE TRACKING - New for trading agents
  const tradesDbScript = `#!/usr/bin/env python3
"""
Trade Journal Database
Record trades with decision logic, outcomes, and reflections.
"""

import sqlite3
import sys
import os
import json

DB_PATH = os.path.expanduser("~/.local/clawdbot/trades.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            trade_id TEXT UNIQUE,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,  -- buy/sell
            entry_price REAL,
            exit_price REAL,
            size REAL,
            strategy TEXT,
            decision_logic TEXT,  -- Why this trade was made
            market_conditions TEXT,
            signals TEXT,  -- JSON array of signals
            outcome TEXT,  -- win/loss/break_even
            pnl REAL,
            pnl_percent REAL,
            reflection TEXT,  -- Post-trade analysis
            lessons_learned TEXT,
            would_take_again BOOLEAN,
            status TEXT DEFAULT 'open'  -- open/closed
        )
    ''')
    
    c.execute('CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_trades_outcome ON trades(outcome)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)')
    
    conn.commit()
    conn.close()
    print(f"Trades database initialized at {DB_PATH}")

def add_trade(symbol, side, **kwargs):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    signals = json.dumps(kwargs.get('signals', []))
    
    c.execute('''
        INSERT INTO trades (trade_id, symbol, side, entry_price, size, strategy, 
                          decision_logic, market_conditions, signals, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (kwargs.get('trade_id'), symbol, side, kwargs.get('entry_price'),
          kwargs.get('size'), kwargs.get('strategy'), kwargs.get('decision_logic'),
          kwargs.get('market_conditions'), signals, kwargs.get('status', 'open')))
    
    trade_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"Trade logged with ID: {trade_id}")

def close_trade(trade_id, exit_price, pnl, pnl_percent, reflection, lessons, would_take_again):
    """Close a trade with outcome and reflection."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    outcome = 'win' if pnl > 0 else 'loss' if pnl < 0 else 'break_even'
    
    c.execute('''
        UPDATE trades 
        SET exit_price = ?, pnl = ?, pnl_percent = ?, outcome = ?,
            reflection = ?, lessons_learned = ?, would_take_again = ?, status = 'closed'
        WHERE id = ? OR trade_id = ?
    ''', (exit_price, pnl, pnl_percent, outcome, reflection, lessons, would_take_again, trade_id, trade_id))
    
    conn.commit()
    updated = c.rowcount
    conn.close()
    
    if updated:
        print(f"Trade {trade_id} closed with {outcome}: {pnl:.2f}")
    else:
        print(f"Trade {trade_id} not found")

def list_trades(symbol=None, strategy=None, outcome=None, limit=20):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    query = 'SELECT id, timestamp, symbol, side, strategy, outcome, pnl, status FROM trades'
    params = []
    conditions = []
    
    if symbol:
        conditions.append('symbol = ?')
        params.append(symbol)
    if strategy:
        conditions.append('strategy = ?')
        params.append(strategy)
    if outcome:
        conditions.append('outcome = ?')
        params.append(outcome)
    
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    
    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.append(limit)
    
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    
    print(f"{'ID':<5} {'Time':<12} {'Symbol':<10} {'Side':<5} {'Strategy':<15} {'Outcome':<8} {'PnL':<10} {'Status'}")
    print("-" * 90)
    for row in rows:
        pnl_str = f"{row[6]:.2f}" if row[6] else "-"
        print(f"{row[0]:<5} {row[1][:10]:<12} {row[2]:<10} {row[3]:<5} {row[4] or '-':<15} {row[5] or '-':<8} {pnl_str:<10} {row[7]}")

def stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) FROM trades')
    total = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM trades WHERE status = "open"')
    open_trades = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*), SUM(pnl) FROM trades WHERE outcome = "win"')
    wins, win_pnl = c.fetchone()
    
    c.execute('SELECT COUNT(*), SUM(pnl) FROM trades WHERE outcome = "loss"')
    losses, loss_pnl = c.fetchone()
    
    c.execute('SELECT symbol, COUNT(*) FROM trades GROUP BY symbol ORDER BY COUNT(*) DESC LIMIT 5')
    by_symbol = c.fetchall()
    
    conn.close()
    
    win_rate = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0
    total_pnl = (win_pnl or 0) + (loss_pnl or 0)
    
    print(f"Trade Statistics:")
    print(f"  Total Trades: {total} ({open_trades} open)")
    print(f"  Win Rate: {win_rate:.1f}% ({wins} wins, {losses} losses)")
    print(f"  Total PnL: {total_pnl:.2f}")
    print(f"  Avg Win: {(win_pnl/wins):.2f}" if wins else "  Avg Win: N/A")
    print(f"  Avg Loss: {(loss_pnl/losses):.2f}" if losses else "  Avg Loss: N/A")
    print(f"\nTop Symbols:")
    for sym, count in by_symbol:
        print(f"  {sym}: {count} trades")

def reflections(limit=10):
    """Show recent trade reflections for learning."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        SELECT id, symbol, outcome, reflection, lessons_learned, would_take_again
        FROM trades
        WHERE reflection IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (limit,))
    
    rows = c.fetchall()
    conn.close()
    
    print("Recent Trade Reflections:")
    print("-" * 80)
    for row in rows:
        print(f"\n[{row[0]}] {row[1]} - {row[2].upper()}")
        print(f"Reflection: {row[3][:100]}..." if row[3] and len(row[3]) > 100 else f"Reflection: {row[3]}")
        print(f"Lessons: {row[4]}")
        print(f"Would take again: {'Yes' if row[5] else 'No'}")

def main():
    if len(sys.argv) < 2:
        print("Usage: trades-db.py [init|add|close|list|stats|reflections] ...")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == 'init':
        init_db()
    elif cmd == 'add':
        if len(sys.argv) < 4:
            print("Usage: trades-db.py add <symbol> <side> [--strategy X] [--logic 'reason']")
            sys.exit(1)
        kwargs = {}
        i = 4
        while i < len(sys.argv):
            if sys.argv[i].startswith('--') and i + 1 < len(sys.argv):
                key = sys.argv[i][2:].replace('-', '_')
                kwargs[key] = sys.argv[i + 1]
                i += 2
            else:
                i += 1
        add_trade(sys.argv[2], sys.argv[3], **kwargs)
    elif cmd == 'close':
        if len(sys.argv) < 9:
            print("Usage: trades-db.py close <id> <exit_price> <pnl> <pnl_pct> '<reflection>' '<lessons>' <would_take_again>")
            sys.exit(1)
        would_take = sys.argv[8].lower() in ('true', 'yes', '1')
        close_trade(int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), 
                   float(sys.argv[5]), sys.argv[6], sys.argv[7], would_take)
    elif cmd == 'list':
        list_trades()
    elif cmd == 'stats':
        stats()
    elif cmd == 'reflections':
        reflections()
    else:
        print(f"Unknown command: {cmd}")

if __name__ == '__main__':
    main()
`;

  const tradesDbPath = path.join(scriptsDir, 'trades-db.py');
  if (!await fs.pathExists(tradesDbPath) || force) {
    await fs.writeFile(tradesDbPath, tradesDbScript);
    await fs.chmod(tradesDbPath, 0o755);
    created.push('trades-db.py');
  }
  
  const tradesWrapper = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
python3 "\${SCRIPT_DIR}/trades-db.py" "$@"
`;

  const tradesShPath = path.join(scriptsDir, 'trades.sh');
  if (!await fs.pathExists(tradesShPath) || force) {
    await fs.writeFile(tradesShPath, tradesWrapper);
    await fs.chmod(tradesShPath, 0o755);
    created.push('trades.sh');
  }
  
  // STRATEGY TRACKING - New for trading agents
  const strategiesDbScript = `#!/usr/bin/env python3
"""
Strategy Tuning Database
Track strategy versions, parameter changes, and user feedback.
"""

import sqlite3
import sys
import os
import json

DB_PATH = os.path.expanduser("~/.local/clawdbot/strategies.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS strategies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            version TEXT DEFAULT '1.0',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            description TEXT,
            parameters TEXT,  -- JSON
            status TEXT DEFAULT 'active',  -- active/paused/deprecated
            performance_rating INTEGER  -- 1-5 scale
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS strategy_tuning (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            strategy_id INTEGER,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            parameter_changed TEXT,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            expected_outcome TEXT,
            actual_outcome TEXT,
            FOREIGN KEY (strategy_id) REFERENCES strategies(id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            strategy_id INTEGER,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            feedback_type TEXT,  -- praise/concern/suggestion/question
            content TEXT,
            action_taken TEXT,
            implemented BOOLEAN DEFAULT 0,
            FOREIGN KEY (strategy_id) REFERENCES strategies(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"Strategies database initialized at {DB_PATH}")

def add_strategy(name, description=None, parameters=None):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    params_json = json.dumps(parameters) if parameters else None
    
    c.execute('''
        INSERT INTO strategies (name, description, parameters)
        VALUES (?, ?, ?)
    ''', (name, description, params_json))
    
    strategy_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"Strategy added with ID: {strategy_id}")

def tune_strategy(strategy_id, parameter, old_val, new_val, reason, expected=None):
    """Record a parameter tuning change."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        INSERT INTO strategy_tuning (strategy_id, parameter_changed, old_value, new_value, reason, expected_outcome)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (strategy_id, parameter, old_val, new_val, reason, expected))
    
    # Update strategy version
    c.execute('SELECT version FROM strategies WHERE id = ?', (strategy_id,))
    row = c.fetchone()
    if row:
        version = row[0]
        parts = version.split('.')
        if len(parts) >= 2:
            parts[1] = str(int(parts[1]) + 1)
            new_version = '.'.join(parts)
        else:
            new_version = version + '.1'
        
        c.execute('UPDATE strategies SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  (new_version, strategy_id))
    
    conn.commit()
    conn.close()
    print(f"Tuning recorded for strategy {strategy_id}")

def add_feedback(strategy_id, feedback_type, content, action=None):
    """Record user feedback about a strategy."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        INSERT INTO user_feedback (strategy_id, feedback_type, content, action_taken)
        VALUES (?, ?, ?, ?)
    ''', (strategy_id, feedback_type, content, action))
    
    feedback_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"Feedback recorded with ID: {feedback_id}")

def mark_implemented(feedback_id):
    """Mark feedback as implemented."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE user_feedback SET implemented = 1 WHERE id = ?', (feedback_id,))
    conn.commit()
    conn.close()
    print(f"Feedback {feedback_id} marked as implemented")

def update_actual_outcome(tuning_id, actual_outcome):
    """Update the actual outcome of a tuning change."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE strategy_tuning SET actual_outcome = ? WHERE id = ?',
              (actual_outcome, tuning_id))
    conn.commit()
    conn.close()
    print(f"Tuning {tuning_id} outcome updated")

def list_strategies():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, name, version, status, performance_rating FROM strategies ORDER BY updated_at DESC')
    rows = c.fetchall()
    conn.close()
    
    print(f"{'ID':<5} {'Name':<20} {'Version':<10} {'Status':<12} {'Rating'}")
    print("-" * 60)
    for row in rows:
        rating = f"{row[4]}/5" if row[4] else "-"
        print(f"{row[0]:<5} {row[1]:<20} {row[2]:<10} {row[3]:<12} {rating}")

def list_tuning(strategy_id=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if strategy_id:
        c.execute('''
            SELECT t.id, s.name, t.parameter_changed, t.old_value, t.new_value, t.reason, t.actual_outcome
            FROM strategy_tuning t
            JOIN strategies s ON t.strategy_id = s.id
            WHERE t.strategy_id = ?
            ORDER BY t.timestamp DESC
        ''', (strategy_id,))
    else:
        c.execute('''
            SELECT t.id, s.name, t.parameter_changed, t.old_value, t.new_value, t.reason, t.actual_outcome
            FROM strategy_tuning t
            JOIN strategies s ON t.strategy_id = s.id
            ORDER BY t.timestamp DESC
            LIMIT 20
        ''')
    
    rows = c.fetchall()
    conn.close()
    
    print("Recent Tuning Changes:")
    print("-" * 80)
    for row in rows:
        actual = f" → {row[6]}" if row[6] else ""
        print(f"[{row[0]}] {row[1]}: {row[2]} {row[3]} → {row[4]}{actual}")
        print(f"    Reason: {row[5][:60]}..." if len(row[5]) > 60 else f"    Reason: {row[5]}")

def list_feedback(strategy_id=None, unimplemented_only=False):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    query = '''
        SELECT f.id, s.name, f.feedback_type, f.content, f.implemented
        FROM user_feedback f
        JOIN strategies s ON f.strategy_id = s.id
    '''
    params = []
    
    conditions = []
    if strategy_id:
        conditions.append('f.strategy_id = ?')
        params.append(strategy_id)
    if unimplemented_only:
        conditions.append('f.implemented = 0')
    
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    
    query += ' ORDER BY f.timestamp DESC'
    
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    
    print(f"{'ID':<5} {'Strategy':<20} {'Type':<12} {'Implemented':<12} {'Content'}")
    print("-" * 80)
    for row in rows:
        impl = "Yes" if row[4] else "No"
        content = row[3][:40] + "..." if len(row[3]) > 40 else row[3]
        print(f"{row[0]:<5} {row[1]:<20} {row[2]:<12} {impl:<12} {content}")

def stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) FROM strategies')
    total = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM strategies WHERE status = "active"')
    active = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM strategy_tuning')
    tunings = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM user_feedback')
    feedback_total = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM user_feedback WHERE implemented = 0')
    pending_feedback = c.fetchone()[0]
    
    conn.close()
    
    print(f"Strategy Statistics:")
    print(f"  Strategies: {total} ({active} active)")
    print(f"  Tuning Changes: {tunings}")
    print(f"  User Feedback: {feedback_total} ({pending_feedback} pending implementation)")

def main():
    if len(sys.argv) < 2:
        print("Usage: strategies-db.py [init|add|tune|feedback|implemented|outcome|list|tuning|feedback-list|stats] ...")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == 'init':
        init_db()
    elif cmd == 'add':
        if len(sys.argv) < 3:
            print("Usage: strategies-db.py add <name> [--description 'desc'] [--params '{}']")
            sys.exit(1)
        kwargs = {}
        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == '--description' and i + 1 < len(sys.argv):
                kwargs['description'] = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == '--params' and i + 1 < len(sys.argv):
                import json
                kwargs['parameters'] = json.loads(sys.argv[i + 1])
                i += 2
            else:
                i += 1
        add_strategy(sys.argv[2], **kwargs)
    elif cmd == 'tune':
        if len(sys.argv) < 7:
            print("Usage: strategies-db.py tune <strategy_id> <param> <old> <new> '<reason>' [--expected 'outcome']")
            sys.exit(1)
        expected = None
        if '--expected' in sys.argv:
            idx = sys.argv.index('--expected')
            expected = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
        tune_strategy(int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6], expected)
    elif cmd == 'feedback':
        if len(sys.argv) < 5:
            print("Usage: strategies-db.py feedback <strategy_id> <type> '<content>' [--action 'action']")
            sys.exit(1)
        action = None
        if '--action' in sys.argv:
            idx = sys.argv.index('--action')
            action = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
        add_feedback(int(sys.argv[2]), sys.argv[3], sys.argv[4], action)
    elif cmd == 'implemented':
        if len(sys.argv) < 3:
            print("Usage: strategies-db.py implemented <feedback_id>")
            sys.exit(1)
        mark_implemented(int(sys.argv[2]))
    elif cmd == 'outcome':
        if len(sys.argv) < 4:
            print("Usage: strategies-db.py outcome <tuning_id> '<actual_outcome>'")
            sys.exit(1)
        update_actual_outcome(int(sys.argv[2]), sys.argv[3])
    elif cmd == 'list':
        list_strategies()
    elif cmd == 'tuning':
        strategy_id = int(sys.argv[2]) if len(sys.argv) > 2 else None
        list_tuning(strategy_id)
    elif cmd == 'feedback-list':
        strategy_id = None
        unimpl = False
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == '--strategy' and i + 1 < len(sys.argv):
                strategy_id = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == '--unimplemented':
                unimpl = True
                i += 1
            else:
                i += 1
        list_feedback(strategy_id, unimpl)
    elif cmd == 'stats':
        stats()
    else:
        print(f"Unknown command: {cmd}")

if __name__ == '__main__':
    main()
`;

  const strategiesDbPath = path.join(scriptsDir, 'strategies-db.py');
  if (!await fs.pathExists(strategiesDbPath) || force) {
    await fs.writeFile(strategiesDbPath, strategiesDbScript);
    await fs.chmod(strategiesDbPath, 0o755);
    created.push('strategies-db.py');
  }
  
  const strategiesWrapper = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
python3 "\${SCRIPT_DIR}/strategies-db.py" "$@"
`;

  const strategiesShPath = path.join(scriptsDir, 'strategies.sh');
  if (!await fs.pathExists(strategiesShPath) || force) {
    await fs.writeFile(strategiesShPath, strategiesWrapper);
    await fs.chmod(strategiesShPath, 0o755);
    created.push('strategies.sh');
  }
  
  // Initialize the databases
  try {
    const { execSync } = require('child_process');
    execSync(`python3 "${errorsDbPath}" init`, { stdio: 'ignore' });
    execSync(`python3 "${tasksDbPath}" init`, { stdio: 'ignore' });
    execSync(`python3 "${tradesDbPath}" init`, { stdio: 'ignore' });
    execSync(`python3 "${strategiesDbPath}" init`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore init errors during setup
  }
  
  return created;
}

module.exports = { setupTraderSQLite };
