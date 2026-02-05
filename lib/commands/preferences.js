const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { 
  getPendingCandidates, 
  getCandidatesSummary, 
  confirmPreference, 
  rejectPreference 
} = require('../utils/conversation-memory');

async function preferencesCommand(action, options) {
  const targetDir = path.resolve(options.dir);
  
  if (action === 'list') {
    const candidates = await getPendingCandidates(targetDir);
    
    if (candidates.length === 0) {
      console.log(chalk.gray('\nNo pending preference candidates.\n'));
      return;
    }
    
    console.log(chalk.bold.blue(`\n📝 ${candidates.length} Pending Preference Candidates\n`));
    
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const confidenceColor = c.confidence > 0.7 ? chalk.green : chalk.yellow;
      
      console.log(chalk.bold(`${i + 1}. [${c.id.slice(-8)}]`));
      console.log(chalk.gray(`   Original: "${c.source_message.slice(0, 80)}${c.source_message.length > 80 ? '...' : ''}"`));
      console.log(chalk.gray(`   Suggested: ${c.suggested_constitution_entry}`));
      console.log(chalk.gray(`   Category: ${c.category}`));
      console.log(confidenceColor(`   Confidence: ${(c.confidence * 100).toFixed(0)}%`));
      console.log();
    }
    
    console.log(chalk.gray('Commands:'));
    console.log(chalk.gray('  downrigger preferences confirm <id>    # Add to CONSTITUTION'));
    console.log(chalk.gray('  downrigger preferences reject <id>     # Discard'));
    console.log();
    return;
  }
  
  if (action === 'confirm') {
    const id = options.id;
    if (!id) {
      console.log(chalk.red('Error: Candidate ID required'));
      console.log(chalk.gray('Usage: downrigger preferences confirm <id>'));
      process.exit(1);
    }
    
    // Allow short IDs (last 8 chars)
    const candidates = await getPendingCandidates(targetDir);
    const candidate = candidates.find(c => c.id === id || c.id.endsWith(id));
    
    if (!candidate) {
      console.log(chalk.red(`Error: Candidate "${id}" not found`));
      process.exit(1);
    }
    
    try {
      await confirmPreference(targetDir, candidate.id);
      console.log(chalk.bold.green('\n✅ Preference confirmed and added to CONSTITUTION\n'));
      console.log(chalk.gray(`Added: ${candidate.suggested_constitution_entry}`));
      console.log();
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
    return;
  }
  
  if (action === 'reject') {
    const id = options.id;
    if (!id) {
      console.log(chalk.red('Error: Candidate ID required'));
      console.log(chalk.gray('Usage: downrigger preferences reject <id>'));
      process.exit(1);
    }
    
    const candidates = await getPendingCandidates(targetDir);
    const candidate = candidates.find(c => c.id === id || c.id.endsWith(id));
    
    if (!candidate) {
      console.log(chalk.red(`Error: Candidate "${id}" not found`));
      process.exit(1);
    }
    
    try {
      await rejectPreference(targetDir, candidate.id, options.reason);
      console.log(chalk.bold.yellow('\n🗑️  Preference candidate rejected\n'));
      console.log();
    } catch (err) {
      console.log(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
    return;
  }
  
  if (action === 'summary') {
    const summary = await getCandidatesSummary(targetDir);
    console.log('\n' + summary + '\n');
    return;
  }
  
  // Default: show help
  console.log(chalk.bold.blue('\n📝 Preferences Command\n'));
  console.log('Manage conversation-derived preference candidates.\n');
  console.log('Usage: downrigger preferences <action> [options]\n');
  console.log('Actions:');
  console.log('  list              Show pending candidates');
  console.log('  summary           Get chat-friendly summary');
  console.log('  confirm <id>      Confirm and pin to CONSTITUTION');
  console.log('  reject <id>       Reject candidate\n');
  console.log('Options:');
  console.log('  -d, --dir         Workspace directory');
  console.log('  --id              Candidate ID (for confirm/reject)');
  console.log('  --reason          Rejection reason\n');
  console.log(chalk.gray('Detected preferences are NOT active until confirmed.'));
  console.log(chalk.gray('This prevents "LLM drift" from casual conversation.\n'));
}

module.exports = { preferencesCommand };
