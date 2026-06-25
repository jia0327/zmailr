import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createUserToken, deleteUserToken, UserTokenItem } from '../utils/api';
import {
  loadStoredTokens,
  maskApiToken,
  migrateLegacySessionTokens,
  pruneStoredTokens,
  removeStoredToken,
  saveStoredToken,
} from '../utils/apiTokenSession';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';

const ALL_SCOPES = ['lease', 'mail', 'send'] as const;

const SCOPE_I18N: Record<(typeof ALL_SCOPES)[number], { label: string; desc: string }> = {
  lease: { label: 'tokens.scopeLease', desc: 'tokens.scopeLeaseDesc' },
  mail: { label: 'tokens.scopeMail', desc: 'tokens.scopeMailDesc' },
  send: { label: 'tokens.scopeSend', desc: 'tokens.scopeSendDesc' },
};

const SCOPE_COLORS: Record<(typeof ALL_SCOPES)[number], string> = {
  lease: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  mail: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  send: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
};

const getApiOrigin = () => {
  const base = API_BASE_URL?.replace(/\/$/, '') || '';
  return base || window.location.origin;
};

const buildQuotaCurl = (token: string) =>
  `curl -s -H "Authorization: Bearer ${token}" "${getApiOrigin()}/api/user/quota"`;

const ScopeBadges: React.FC<{ scopes: string[]; t: (key: string) => string }> = ({ scopes, t }) => (
  <div className="flex flex-wrap gap-1.5">
    {scopes.map((s) => {
      const known = s in SCOPE_I18N;
      const color = known ? SCOPE_COLORS[s as (typeof ALL_SCOPES)[number]] : 'bg-muted text-muted-foreground border-border';
      return (
        <span
          key={s}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}
          title={known ? t(SCOPE_I18N[s as (typeof ALL_SCOPES)[number]].desc) : s}
        >
          {known ? t(SCOPE_I18N[s as (typeof ALL_SCOPES)[number]].label) : s}
        </span>
      );
    })}
  </div>
);

interface ApiTokenManagerProps {
  compact?: boolean;
  /** Open the create form when the user has no tokens (e.g. from dashboard reminder). */
  autoOpenCreate?: boolean;
}

const expiresInDaysFromToken = (tok: UserTokenItem) => {
  const expiresMs = tok.expiresAt > 1e12 ? tok.expiresAt : tok.expiresAt * 1000;
  const days = Math.ceil((expiresMs - Date.now()) / 86_400_000);
  return Math.max(1, Math.min(365, days));
};

const ApiTokenManager: React.FC<ApiTokenManagerProps> = ({ compact = false, autoOpenCreate = false }) => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [tokens, setTokens] = useState<UserTokenItem[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenDays, setNewTokenDays] = useState(30);
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>([...ALL_SCOPES]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | 'created' | 'curl' | null>(null);
  const [storedTokens, setStoredTokens] = useState<Record<number, string>>({});
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const syncStoredTokens = (nextTokens: UserTokenItem[]) => {
    if (!user) return;
    const ids = nextTokens.map((tok) => tok.id);
    migrateLegacySessionTokens(user.id, ids);
    pruneStoredTokens(user.id, ids);
    setStoredTokens(loadStoredTokens(user.id, ids));
  };

  const loadTokens = async () => {
    setTokensLoading(true);
    try {
      const res = await fetch('/api/user/tokens', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens);
        syncStoredTokens(data.tokens);
        if (autoOpenCreate && data.tokens.length === 0) {
          setShowCreate(true);
        }
      }
    } finally {
      setTokensLoading(false);
    }
  };

  React.useEffect(() => {
    loadTokens();
  }, [user?.id]);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    const result = await createUserToken({
      name: newTokenName || undefined,
      expiresInDays: newTokenDays,
      scopes: newTokenScopes,
    });
    if (result.success && result.token) {
      saveStoredToken(user.id, result.token.id, result.token.token);
      setCreatedToken(result.token.token);
      setStoredTokens((prev) => ({ ...prev, [result.token!.id]: result.token!.token }));
      setShowCreate(false);
      setNewTokenName('');
      await loadTokens();
      await refresh();
    } else {
      setError(result.error || t('auth.tokenCreateFailed'));
    }
  };

  const handleDeleteToken = async (id: number) => {
    if (!user) return;
    if (!confirm(t('auth.confirmDeleteToken'))) return;
    await deleteUserToken(id);
    removeStoredToken(user.id, id);
    setStoredTokens((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (createdToken && storedTokens[id] === createdToken) {
      setCreatedToken(null);
    }
    await loadTokens();
    await refresh();
  };

  const handleRegenerateToken = async (tok: UserTokenItem) => {
    if (!user) return;
    if (!confirm(t('tokens.confirmRegenerateToken'))) return;

    setRegeneratingId(tok.id);
    setError('');
    try {
      await deleteUserToken(tok.id);
      removeStoredToken(user.id, tok.id);

      const result = await createUserToken({
        name: tok.name || undefined,
        expiresInDays: expiresInDaysFromToken(tok),
        scopes: tok.scopes,
      });

      if (result.success && result.token) {
        saveStoredToken(user.id, result.token.id, result.token.token);
        setCreatedToken(result.token.token);
        setStoredTokens({ [result.token.id]: result.token.token });
        await loadTokens();
        await refresh();
      } else {
        setError(result.error || t('auth.tokenCreateFailed'));
        await loadTokens();
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  const toggleScope = (scope: string) => {
    setNewTokenScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const copyText = (text: string, copyKey: number | 'created' | 'curl', successMsg?: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(copyKey);
        showSuccessMessage(successMsg ?? t('tokens.tokenCopySuccess'));
        window.setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => showErrorMessage(t('mailbox.copyFailed')));
  };

  const copyToken = (token: string, copyKey: number | 'created') => copyText(token, copyKey);

  const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );

  const fmtTime = (ts: number) => new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString();
  const hasToken = tokens.length > 0;

  return (
    <div className="space-y-4">
      {createdToken && (
        <div className="border border-primary/50 rounded-lg p-4 bg-primary/5">
          <p className="text-sm font-medium mb-2">{t('auth.tokenCreated')}</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 text-xs break-all bg-muted p-2 rounded font-mono">{createdToken}</code>
            <button
              type="button"
              onClick={() => copyToken(createdToken, 'created')}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              title={t('tokens.copyToken')}
            >
              <CopyIcon />
              {copiedId === 'created' ? t('common.copied') : t('tokens.copyToken')}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t('auth.tokenCopyWarning')}</p>
          <button onClick={() => setCreatedToken(null)} className="text-xs mt-2 text-primary">
            {t('common.close')}
          </button>
        </div>
      )}

      <div className={compact ? 'space-y-3' : 'border rounded-lg p-4 bg-card'}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={compact ? 'text-sm font-semibold' : 'font-semibold'}>{t('auth.apiTokens')}</h2>
          {!hasToken && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 ring-2 ring-amber-500/50 ring-offset-2 ring-offset-background"
            >
              {t('auth.createToken')}
            </button>
          )}
        </div>

        {showCreate && (
          <form onSubmit={handleCreateToken} className="mb-4 p-3 border rounded-md space-y-3">
            {error && <p className="text-destructive text-sm">{error}</p>}
            <input
              type="text"
              placeholder={t('auth.tokenName')}
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            />
            <div>
              <label htmlFor="token-expires-days" className="text-sm font-medium block mb-1">
                {t('tokens.expiresDaysLabel')}
              </label>
              <div className="relative">
                <input
                  id="token-expires-days"
                  type="number"
                  min={1}
                  max={365}
                  value={newTokenDays}
                  onChange={(e) => setNewTokenDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 pr-10 border rounded-md bg-background text-sm"
                  placeholder={t('tokens.expiresDaysPlaceholder')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  {t('tokens.daysUnit')}
                </span>
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('tokens.scopesLabel')}</legend>
              {ALL_SCOPES.map((s) => (
                <label
                  key={s}
                  className="flex items-start gap-2 text-sm cursor-pointer"
                  title={t(SCOPE_I18N[s].desc)}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={newTokenScopes.includes(s)}
                    onChange={() => toggleScope(s)}
                  />
                  <span>
                    <span className="font-medium">{t(SCOPE_I18N[s].label)}</span>
                    <span className="block text-xs text-muted-foreground">{t(SCOPE_I18N[s].desc)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md">
              {t('common.create')}
            </button>
          </form>
        )}

        {tokensLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('auth.noTokens')}</p>
        ) : (
          <div className="space-y-3">
            {tokens.map((tok) => {
              const plaintext = storedTokens[tok.id];
              const canCopy = Boolean(plaintext);
              const isRegenerating = regeneratingId === tok.id;

              return (
                <div key={tok.id} className="border rounded-md p-3 text-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p>
                        <span className="text-muted-foreground">{t('tokens.nameLabel')}: </span>
                        <span className="font-medium">{tok.name || `#${tok.id}`}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('tokens.permissionsLabel')}: </span>
                      </p>
                      <ScopeBadges scopes={tok.scopes} t={t} />
                      <p>
                        <span className="text-muted-foreground">{t('tokens.expiresAtLabel')}: </span>
                        <span>{fmtTime(tok.expiresAt)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('tokens.lastUsedAtLabel')}: </span>
                        <span>{tok.lastUsedAt ? fmtTime(tok.lastUsedAt) : t('tokens.lastUsedNever')}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('tokens.tokenPreviewLabel')}: </span>
                        {plaintext ? (
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{maskApiToken(plaintext)}</code>
                        ) : (
                          <span className="text-muted-foreground text-xs">{t('tokens.noPlaintextHint')}</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteToken(tok.id)}
                      className="text-destructive hover:underline text-xs shrink-0"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  {canCopy ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => copyToken(plaintext, tok.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                        title={t('tokens.copyToken')}
                      >
                        <CopyIcon />
                        {copiedId === tok.id ? t('common.copied') : t('tokens.copyToken')}
                      </button>
                      <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{t('tokens.curlExampleLabel')}</p>
                        <code className="block text-xs break-all font-mono">{buildQuotaCurl(plaintext)}</code>
                        <button
                          type="button"
                          onClick={() => copyText(buildQuotaCurl(plaintext), 'curl', t('tokens.curlCopySuccess'))}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <CopyIcon />
                          {copiedId === 'curl' ? t('common.copied') : t('tokens.copyOneClick')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">{t('tokens.copyUnavailable')}</p>
                      <button
                        type="button"
                        disabled={isRegenerating}
                        onClick={() => handleRegenerateToken(tok)}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {isRegenerating ? t('common.loading') : t('tokens.recreateToCopy')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiTokenManager;
