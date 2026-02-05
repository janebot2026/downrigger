const Mustache = require('mustache');

// Voice-aware message templates - cosmetic only, never affects trading logic
const voiceMessages = {
  direct: {
    trade_executed: 'Trade {{symbol}} {{direction}}. Size: {{size}}. Slippage: {{slippage}}%.',
    trade_blocked: 'Blocked: {{symbol}} {{direction}}. Reason: {{reason}}.',
    position_closed: 'Closed {{symbol}} at {{price}}. PnL: {{pnl}}.',
    incident_summary: '{{type}}: {{symptom}}. Impact: {{impact}}. Fix: {{fix}}.',
    daily_recap_intro: 'Trades today: {{count}}. PnL: {{pnl}}.',
    learning_summary: 'Learned: {{lesson}}. Updated: {{change}}.'
  },
  calm: {
    trade_executed: 'I executed a {{direction}} trade in {{symbol}} with a position size of {{size}}. The slippage was {{slippage}}%, which is within acceptable parameters.',
    trade_blocked: 'I decided not to proceed with the {{direction}} trade in {{symbol}}. The reason is {{reason}}, and this aligns with our risk management approach.',
    position_closed: 'The {{symbol}} position has been closed at {{price}}. The realized PnL is {{pnl}}.',
    incident_summary: 'I encountered a {{type}} situation: {{symptom}}. The impact was {{impact}}, and I recommend {{fix}} as the next step.',
    daily_recap_intro: 'Today I executed {{count}} trades with a total PnL of {{pnl}}.',
    learning_summary: 'From today\'s activity, I\'ve learned that {{lesson}}. I\'ve made an adjustment: {{change}}.'
  },
  nerdy: {
    trade_executed: 'EXEC: {{symbol}} {{direction}} | qty={{size}} | slippage={{slippage}}% | latency={{latency}}ms | confirmation={{txId}}',
    trade_blocked: 'BLOCK: {{symbol}} {{direction}} | reason_code={{reasonCode}} | rule_triggered={{rule}} | confidence={{confidence}}',
    position_closed: 'CLOSE: {{symbol}} @ {{price}} | realized_pnl={{pnl}} | hold_time={{holdTime}} | exit_reason={{reason}}',
    incident_summary: 'INCIDENT[{{type}}]: {{symptom}} | severity={{severity}} | recovery_time={{recovery}} | root_cause={{cause}} | remediation={{fix}}',
    daily_recap_intro: 'SESSION_METRICS: trades={{count}} | pnl={{pnl}} | sharpe={{sharpe}} | max_dd={{drawdown}} | win_rate={{winRate}}',
    learning_summary: 'HYPOTHESIS_UPDATE: observation={{lesson}} | action={{change}} | confidence={{confidence}} | sample_size={{n}}'
  }
};

// Render a message with the configured voice
function renderVoiceMessage(messageKey, data, voice = 'direct') {
  const voiceSet = voiceMessages[voice] || voiceMessages.direct;
  const template = voiceSet[messageKey] || voiceMessages.direct[messageKey];
  return Mustache.render(template, data);
}

// Get available voices
function getAvailableVoices() {
  return Object.keys(voiceMessages);
}

// Get example of voice
function getVoiceExample(voice) {
  const examples = {
    direct: {
      name: 'Direct',
      description: 'Blunt, concise, no fluff',
      sample: 'Lost $45 on SOL. Stop was too tight. Widening to 8%.'
    },
    calm: {
      name: 'Calm',
      description: 'Measured, explanatory, reassuring',
      sample: 'The SOL position closed with a $45 loss. The stop-loss trigger was within expected parameters but slightly tighter than optimal.'
    },
    nerdy: {
      name: 'Nerdy',
      description: 'Technical, precise, loves details',
      sample: 'SOL/USDC long closed at -$45 PnL. Stop-loss triggered at 1.2% adverse move (vs 1.5% avg volatility).'
    }
  };
  return examples[voice] || examples.direct;
}

module.exports = {
  renderVoiceMessage,
  getAvailableVoices,
  getVoiceExample,
  voiceMessages
};
