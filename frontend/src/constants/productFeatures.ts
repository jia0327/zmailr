/** Shared product capability list for landing page and login hero. */
export const PRODUCT_FEATURES = [
  { icon: 'fas fa-envelope', titleKey: 'landing.primitiveReceiveTitle', descKey: 'landing.primitiveReceiveDesc' },
  { icon: 'fas fa-clock', titleKey: 'landing.primitivePollTitle', descKey: 'landing.primitivePollDesc' },
  { icon: 'fas fa-robot', titleKey: 'landing.primitiveAgentTitle', descKey: 'landing.primitiveAgentDesc' },
  { icon: 'fas fa-inbox', titleKey: 'landing.consoleInbox', descKey: 'landing.consoleInboxDesc' },
  { icon: 'fas fa-paper-plane', titleKey: 'landing.consoleOutbox', descKey: 'landing.consoleOutboxDesc' },
  { icon: 'fas fa-filter', titleKey: 'landing.consoleRules', descKey: 'landing.consoleRulesDesc' },
  { icon: 'fas fa-key', titleKey: 'landing.consoleApiKeys', descKey: 'landing.consoleApiKeysDesc' },
  { icon: 'fas fa-terminal', titleKey: 'landing.consoleDebug', descKey: 'landing.consoleDebugDesc' },
  { icon: 'fas fa-chart-bar', titleKey: 'landing.consoleUsage', descKey: 'landing.consoleUsageDesc' },
] as const;
