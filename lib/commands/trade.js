const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const program = new Command();

/**
 * Trade command - Execute trades via claw-trader-cli
 */
program
  .name('trade')
  .description('Execute trades via claw-trader-cli')
  .option('-p, --price <mint>', 'Get price for a token mint')
  .option('-s, --swap <input> <output> <amount>', 'Execute a swap')
  .option('--paper', 'Use paper trading mode (default)')
  .option('--live', 'Use live trading mode (requires confirmation)')
  .option('-c, --config <path>', 'Path to trading config', '/opt/trawling-traders/.config/claw-trader')
  .action(async (options) => {
    const spinner = ora('Initializing trading...').start();
    
    try {
      // Check if claw-trader is installed
      const traderPath = process.env.CLAW_TRADER_PATH || 'claw-trader';
      
      try {
        execSync(`${traderPath} --version`, { stdio: 'ignore' });
      } catch {
        spinner.fail(chalk.red('claw-trader-cli not found. Run: cargo install --git https://github.com/janebot2026/claw-trader-cli'));
        process.exit(1);
      }
      
      spinner.succeed('Trading tools ready');
      
      // Handle price check
      if (options.price) {
        const priceSpinner = ora(`Fetching price for ${options.price}...`).start();
        try {
          const result = execSync(
            `${traderPath} --json price --input-mint ${options.price} --output-mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --amount 1000000`,
            { encoding: 'utf8', cwd: process.env.WORKSPACE_DIR || '/opt/trawling-traders' }
          );
          const data = JSON.parse(result);
          priceSpinner.succeed(chalk.green(`Price: ${data.outAmount} USDC`));
          console.log(data);
        } catch (error) {
          priceSpinner.fail(chalk.red('Failed to fetch price'));
          console.error(error.stderr || error.message);
        }
        return;
      }
      
      // Handle swap
      if (options.swap) {
        const [input, output, amount] = options.swap;
        const mode = options.live ? 'LIVE' : 'PAPER';
        
        console.log(chalk.yellow(`\n⚠️  ${mode} TRADE`));
        console.log(`Input: ${input}`);
        console.log(`Output: ${output}`);
        console.log(`Amount: ${amount}`);
        
        if (options.live) {
          console.log(chalk.red('\n🚨 LIVE MODE - REAL FUNDS AT RISK'));
          console.log(chalk.yellow('Use --paper flag for paper trading\n'));
        } else {
          console.log(chalk.green('\n📝 PAPER TRADING MODE\n'));
        }
        
        // In a real implementation, we'd prompt for confirmation here
        // For now, just show the command that would be executed
        console.log(chalk.gray(`Command: ${traderPath} --json swap --input-mint ${input} --output-mint ${output} --amount ${amount}`));
        
        return;
      }
      
      // Default: show trading status
      console.log(chalk.blue('\n📊 Trawling Traders - Trading Status\n'));
      console.log(`Config path: ${options.config}`);
      console.log(`Trader path: ${traderPath}`);
      console.log(`Mode: ${options.live ? 'LIVE' : 'PAPER'}`);
      console.log(`\nUse --price or --swap to execute trades`);
      console.log(chalk.gray('See: claw-trader --help for more options\n'));
      
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

module.exports = program;
