const fs = require('fs-extra');
const path = require('path');

async function setupParaStructure(targetDir, options = {}) {
  const { dryRun = false, force = false } = options;
  
  const dirs = [
    'knowledge/projects',
    'knowledge/areas/people',
    'knowledge/areas/companies',
    'knowledge/resources',
    'knowledge/archives',
    'knowledge/tacit',
    'knowledge/schema',
    'memory',
    'scripts',
    'tasks',
    'research'
  ];
  
  for (const dir of dirs) {
    const fullPath = path.join(targetDir, dir);
    if (dryRun) {
      // Just check if exists
      const exists = await fs.pathExists(fullPath);
      if (!exists) {
        console.log(`  Would create: ${dir}`);
      }
    } else {
      await fs.ensureDir(fullPath);
    }
  }
  
  // Create index.md
  const indexPath = path.join(targetDir, 'knowledge', 'index.md');
  const indexContent = `# Knowledge Index

## Active Projects

*(Projects with clear goals/deadlines — move to Archives when done)*

## Active Areas

*(Ongoing responsibilities — no end date)*

### People

### Companies

## Resources

*(Reference material and topics of interest)*

## Archives

*(Inactive items from other categories — never delete, just move)*

---

*This index follows the PARA method (Projects, Areas, Resources, Archives)*
*See: https://fortelabs.com/blog/para/*
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

module.exports = { setupParaStructure };
