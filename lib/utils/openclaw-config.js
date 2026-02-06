const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');

/**
 * Prompt user for OpenClaw configuration
 */
async function promptOpenClawConfig() {
  console.log(chalk.bold.blue('\n🔧 OpenClaw Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'llmProvider',
      message: 'LLM Provider (e.g., google, openai-codex, anthropic, venice):',
      default: 'google'
    },
    {
      type: 'input',
      name: 'llmApiKey',
      message: 'API Key:',
      // Free-form provider input - API key required for cloud providers
      validate: (input) => input.length > 0 || 'API key is required'
    },
    {
      type: 'input',
      name: 'llmModel',
      message: 'Model (e.g., gemini-3-pro, gpt-4o, claude-3-5-sonnet):',
      default: 'gemini-3-pro'
    },
    {
      type: 'confirm',
      name: 'enableTelegram',
      message: 'Enable Telegram bot?',
      default: true
    },
    {
      type: 'input',
      name: 'telegramBotToken',
      message: 'Telegram Bot Token (from @BotFather):',
      when: (answers) => answers.enableTelegram,
      validate: (input) => {
        if (!input) return 'Bot token is required';
        if (!input.match(/^\d+:[A-Za-z0-9_-]+$/)) return 'Invalid format';
        return true;
      }
    }
  ]);

  return {
    llm: {
      provider: answers.llmProvider,
      model: answers.llmModel,
      apiKey: answers.llmApiKey || ''
    },
    telegram: {
      enabled: answers.enableTelegram,
      botToken: answers.telegramBotToken || ''
    }
  };
}

/**
 * Render proper OpenClaw config matching actual schema
 */
function renderOpenClawConfig(config) {
  const provider = config.llm.provider;
  const model = config.llm.model;
  const apiKey = config.llm.apiKey;

  return {
    version: 1,
    bot_id: config.botId || '',
    
    // Agent identity
    auth: {
      profiles: {
        [provider + ":default"]: { provider: provider, mode: "api_key" }
      }
    },
    agent: {
      name: config.agentName || 'Jane',
      persona: config.persona || 'direct'
    },

    // Models configuration - proper structure
    models: {
      mode: 'merge',
      providers: {
        [provider]: {
          apiKey: apiKey,
          models: [
            {
              id: model,
              name: model.split('-').slice(0, 2).join('-'),
              input: ['text'],
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0
              }
            }
          ]
        }
      }
    },

    // Agents section with defaults
    agents: {
      defaults: {
        model: {
          primary: `${provider}/${model}`,
          fallbacks: []
        },
        workspace: config.workspaceDir || '/opt/trading-agent/workspace',
        maxConcurrent: 4
      },
      list: [
        {
          id: 'main',
          default: true,
          workspace: config.workspaceDir || '/opt/trading-agent/workspace'
        }
      ]
    },

    // Channels configuration
    channels: {
      telegram: {
        enabled: config.telegram.enabled,
        botToken: config.telegram.botToken,
        groupPolicy: 'allowlist',
        chats: {}
      }
    },

    // Gateway settings
    gateway: {
      port: 18789,
      mode: 'local',
      bind: 'loopback',
      auth: {
        mode: 'token',
        token: generateSecureToken()
      }
    }
  };
}

function generateSecureToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

async function writeOpenClawConfig(targetDir, config) {
  const openclawDir = path.join(targetDir, '.openclaw');
  await fs.ensureDir(openclawDir);

  const configPath = path.join(openclawDir, 'config.json');
  await fs.writeJson(configPath, config, { spaces: 2 });

  // Write .env with secrets
  const envPath = path.join(openclawDir, '.env');
  const provider = config.models.providers[Object.keys(config.models.providers)[0]];
  const envContent = `# OpenClaw Environment
${Object.keys(config.models.providers)[0].toUpperCase()}_API_KEY="${provider.apiKey}"
TELEGRAM_BOT_TOKEN="${config.channels.telegram.botToken}"
OPENCLAW_GATEWAY_TOKEN="${config.gateway.auth.token}"
`;
  await fs.writeFile(envPath, envContent);
  await fs.chmod(configPath, 0o600);
  await fs.chmod(envPath, 0o600);

  return { configPath, envPath };
}

module.exports = {
  promptOpenClawConfig,
  renderOpenClawConfig,
  writeOpenClawConfig
};
