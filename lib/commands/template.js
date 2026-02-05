const fs = require('fs-extra');
const chalk = require('chalk');
const { renderTemplate, listTemplates } = require('../utils/templates');

async function templateCommand(name, options) {
  if (options.list || !name) {
    console.log(chalk.blue('\n📄 Available Templates:\n'));
    const templates = listTemplates();
    templates.forEach(t => {
      console.log(chalk.white(`  • ${t}`));
    });
    console.log();
    console.log(chalk.gray('Usage: downrigger template <name> -o <output>'));
    return;
  }
  
  const outputPath = options.output || name;
  
  try {
    const content = renderTemplate(name, { 
      date: new Date().toISOString().split('T')[0],
      agentName: 'Jane',
      ownerName: 'Owner',
      targetDir: process.cwd()
    });
    
    await fs.writeFile(outputPath, content);
    console.log(chalk.green(`✅ Template rendered: ${outputPath}`));
  } catch (err) {
    console.log(chalk.red(`✗ Error: ${err.message}`));
    console.log(chalk.gray('Run with --list to see available templates'));
    process.exit(1);
  }
}

module.exports = { templateCommand };
