const fs = require('fs-extra');
const path = require('path');

async function setupTraderStructure(targetDir, options = {}) {
  const { dryRun = false, force = false } = options;
  
  // Trading-optimized directory structure
  const dirs = [
    // Core identity and config
    'core',
    
    // Knowledge packs (curated, bounded)
    'knowledge/packs',
    'knowledge/pinned',
    'knowledge/entities',
    'knowledge/tacit',
    
    // Journal (structured trading history)
    'journal/trades',
    'journal/decisions',
    'journal/recaps',
    
    // Episodes (A/B strategy tests)
    'episodes/completed',
    
    // Runtime state (read-only snapshots)
    'state',
    
    // Reports (PnL, incidents)
    'reports/daily_pnl',
    'reports/incidents',
    
    // Suggestions (human-approved changes)
    'suggestions',
    
    // Scripts (trading-specific)
    'scripts'
  ];
  
  for (const dir of dirs) {
    const fullPath = path.join(targetDir, dir);
    if (dryRun) {
      const exists = await fs.pathExists(fullPath);
      if (!exists) {
        console.log(`  Would create: ${dir}`);
      }
    } else {
      await fs.ensureDir(fullPath);
    }
  }
  
  // Create knowledge index (trading-focused)
  const indexPath = path.join(targetDir, 'knowledge', 'index.md');
  const indexContent = `# Trading Knowledge Index

## Pinned Rules (Constitution)
Risk limits, safety constraints, user preferences.
See: pinned/CONSTITUTION.md

## Knowledge Packs
Curated, bounded packs:
- **packs/risk/** — Risk management patterns
- **packs/execution/** — Trade execution best practices
- **packs/strategy/** — Strategy archetypes and parameters

## Entities
- **entities/tokens/** — Token metadata (mints, decimals, notes)
- **entities/venues/** — Exchanges, liquidity sources

## Tacit Knowledge
Operational patterns learned by THIS bot:
- What works in current market conditions
- Execution timing insights
- Failure patterns to avoid

---

*Structured for continuous learning and explainability*
`;
  
  if (dryRun) {
    const exists = await fs.pathExists(indexPath);
    if (!exists || force) {
      console.log(`  Would write: knowledge/index.md`);
    }
  } else if (!await fs.pathExists(indexPath) || force) {
    await fs.writeFile(indexPath, indexContent);
  }
}

module.exports = { setupTraderStructure };
