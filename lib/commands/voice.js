const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { getAvailableVoices, getVoiceExample } = require('../utils/voice');

async function voiceCommand(action, options) {
  const targetDir = path.resolve(options.dir);
  const voicePath = path.join(targetDir, 'core', 'VOICE.md');
  
  if (action === 'list') {
    console.log(chalk.bold.blue('\n🎙️  Available Voices\n'));
    
    const voices = getAvailableVoices();
    for (const v of voices) {
      const info = getVoiceExample(v);
      console.log(chalk.bold(`${info.name} (${v})`));
      console.log(chalk.gray(`  ${info.description}`));
      console.log(chalk.gray(`  Example: "${info.sample}"`));
      console.log();
    }
    
    console.log(chalk.gray('Voice is cosmetic only - it changes how the bot writes, never what it trades.'));
    console.log(chalk.gray(`Set with: downrigger voice set <name>`));
    console.log();
    return;
  }
  
  if (action === 'set') {
    const voiceName = options.voice;
    if (!voiceName) {
      console.log(chalk.red('Error: Voice name required'));
      console.log(chalk.gray('Usage: downrigger voice set <direct|calm|nerdy>'));
      process.exit(1);
    }
    
    const voices = getAvailableVoices();
    if (!voices.includes(voiceName)) {
      console.log(chalk.red(`Error: Unknown voice "${voiceName}"`));
      console.log(chalk.gray(`Available: ${voices.join(', ')}`));
      process.exit(1);
    }
    
    // Update TRADING_CONFIG.md
    const configPath = path.join(targetDir, 'core', 'TRADING_CONFIG.md');
    if (await fs.pathExists(configPath)) {
      let content = await fs.readFile(configPath, 'utf8');
      content = content.replace(
        /- \*\*Style:\*\* \[direct \/ calm \/ nerdy\]/,
        `- **Style:** ${voiceName}`
      );
      await fs.writeFile(configPath, content);
    }
    
    const info = getVoiceExample(voiceName);
    console.log(chalk.bold.green(`\n🎙️  Voice set to: ${info.name}\n`));
    console.log(chalk.gray(`Style: ${info.description}`));
    console.log(chalk.gray(`Example: "${info.sample}"`));
    console.log();
    console.log(chalk.gray('Changes take effect on next recap/summary.'));
    console.log(chalk.yellow('Remember: Voice is cosmetic only. Trading logic stays deterministic.'));
    console.log();
    return;
  }
  
  if (action === 'show') {
    const configPath = path.join(targetDir, 'core', 'TRADING_CONFIG.md');
    let currentVoice = 'direct';
    
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf8');
      const match = content.match(/- \*\*Style:\*\* (\w+)/);
      if (match) currentVoice = match[1];
    }
    
    const info = getVoiceExample(currentVoice);
    console.log(chalk.bold.blue('\n🎙️  Current Voice\n'));
    console.log(chalk.bold(`${info.name} (${currentVoice})`));
    console.log(chalk.gray(`Style: ${info.description}`));
    console.log(chalk.gray(`Example: "${info.sample}"`));
    console.log();
    return;
  }
  
  // Default: show help
  console.log(chalk.bold.blue('\n🎙️  Voice Command\n'));
  console.log('Usage: downrigger voice <action> [options]\n');
  console.log('Actions:');
  console.log('  list         List available voices');
  console.log('  show         Show current voice');
  console.log('  set <name>   Set voice (direct|calm|nerdy)\n');
  console.log('Options:');
  console.log('  -d, --dir    Workspace directory');
  console.log('  --voice      Voice name (for set)\n');
  console.log(chalk.gray('Voice is cosmetic only - it changes how the bot writes recaps,'));
  console.log(chalk.gray('incidents, and summaries. Trading logic stays deterministic.'));
  console.log();
}

module.exports = { voiceCommand };
