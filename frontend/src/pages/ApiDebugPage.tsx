import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';
import { getApiBaseUrl } from '../utils/apiDocExamples';
import {
  applyMailboxDefaults,
  resolveMailboxDefaults,
  type MailboxDefaults,
} from '../utils/apiDebugMailboxDefaults';
import { saveLastLease } from '../utils/apiLeaseSession';
import ApiEndpointParamTable from '../components/ApiEndpointParamTable';
import {
  API_DEBUG_CATEGORIES,
  API_DEBUG_ENDPOINTS,
  ApiEndpointDef,
  buildBody,
  buildUrl,
  defaultFieldValues,
  getEndpointById,
} from '../utils/apiDebugEndpoints';
import {
  fieldDescriptionKey,
  getDocsHref,
  getEndpointDescriptionKey,
  getEndpointMeta,
  getParamRows,
} from '../utils/apiEndpointMeta';
import { loadStoredTokens, migrateLegacySessionTokens } from '../utils/apiTokenSession';

interface FetchResult {
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
  isJson: boolean;
  error?: string;
}

const RATE_LIMIT_HEADERS = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];

const ApiDebugPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { mailbox: contextMailbox } = useContext(MailboxContext);
  const baseUrl = useMemo(getApiBaseUrl, []);

  const [autoToken, setAutoToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [useManualToken, setUseManualToken] = useState(false);

  const [selectedId, setSelectedId] = useState(API_DEBUG_ENDPOINTS[0].id);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    defaultFieldValues(API_DEBUG_ENDPOINTS[0])
  );

  const [mailboxDefaults, setMailboxDefaults] = useState<MailboxDefaults | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);

  const endpoint = getEndpointById(selectedId) ?? API_DEBUG_ENDPOINTS[0];
  const endpointMeta = getEndpointMeta(endpoint.id);
  const paramRows = useMemo(() => getParamRows(endpoint), [endpoint]);
  const effectiveToken = useManualToken ? manualToken.trim() : autoToken;

  const loadAutoToken = useCallback(async () => {
    if (!user?.id) {
      setAutoToken(null);
      return;
    }
    try {
      const res = await fetch('/api/user/tokens', { credentials: 'include' });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.tokens) || data.tokens.length === 0) {
        setAutoToken(null);
        return;
      }
      const tokenIds = data.tokens.map((tok: { id: number }) => tok.id);
      migrateLegacySessionTokens(user.id, tokenIds);
      const stored = loadStoredTokens(user.id, tokenIds);
      const firstId = tokenIds[0];
      setAutoToken(stored[firstId] ?? null);
    } catch {
      setAutoToken(null);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAutoToken();
  }, [loadAutoToken]);

  useEffect(() => {
    if (!user?.id) {
      setMailboxDefaults(null);
      return;
    }
    let cancelled = false;
    resolveMailboxDefaults(user.id, contextMailbox?.address).then((defaults) => {
      if (!cancelled) setMailboxDefaults(defaults);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, contextMailbox?.address]);

  useEffect(() => {
    const base = defaultFieldValues(endpoint);
    setFieldValues(
      mailboxDefaults ? applyMailboxDefaults(endpoint, base, mailboxDefaults, false) : base
    );
    setResult(null);
  }, [selectedId]);

  useEffect(() => {
    if (!mailboxDefaults) return;
    setFieldValues((prev) => applyMailboxDefaults(endpoint, prev, mailboxDefaults, true));
  }, [mailboxDefaults, endpoint.id]);

  const endpointsByCategory = useMemo(() => {
    const map = new Map<string, ApiEndpointDef[]>();
    for (const cat of API_DEBUG_CATEGORIES) {
      map.set(cat, API_DEBUG_ENDPOINTS.filter((e) => e.categoryKey === cat));
    }
    return map;
  }, []);

  const handleFieldChange = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateFields = (): string | null => {
    for (const field of endpoint.fields) {
      if (field.required && !(fieldValues[field.name] ?? '').trim()) {
        return t('apiDebug.fieldRequired', { field: field.name });
      }
    }
    if (endpoint.requiresAuth && !effectiveToken) {
      return t('apiDebug.tokenRequired');
    }
    return null;
  };

  const handleSend = async () => {
    const validationError = validateFields();
    if (validationError) {
      setResult({
        status: 0,
        durationMs: 0,
        headers: {},
        body: '',
        isJson: false,
        error: validationError,
      });
      return;
    }

    setLoading(true);
    setResult(null);

    const url = buildUrl(baseUrl, endpoint, fieldValues);
    const headers: Record<string, string> = {};
    if (endpoint.requiresAuth && effectiveToken) {
      headers.Authorization = `Bearer ${effectiveToken}`;
    }
    const body = buildBody(endpoint, fieldValues);
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const timeoutSec = endpoint.id === 'mail-poll'
      ? Math.min(Math.max(parseInt(fieldValues.timeout || '60', 10), 1), 55) + 10
      : 30;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutSec * 1000);

    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: endpoint.method,
        headers,
        body: endpoint.method === 'POST' ? body : undefined,
        signal: controller.signal,
      });

      const durationMs = Math.round(performance.now() - start);
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key.toLowerCase()] = value;
      });

      const contentType = res.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json') || endpoint.responseType === 'json';
      let responseBody: string;
      if (isJson) {
        try {
          const json = await res.json();
          if (
            endpoint.id === 'lease' &&
            res.ok &&
            json.success &&
            json.address &&
            typeof json.email === 'string' &&
            user?.id
          ) {
            saveLastLease(user.id, { address: json.address, email: json.email });
            setMailboxDefaults({ localPart: json.address, fullEmail: json.email });
          }
          responseBody = JSON.stringify(json, null, 2);
        } catch {
          responseBody = await res.text();
        }
      } else {
        responseBody = await res.text();
      }

      setResult({
        status: res.status,
        durationMs,
        headers: resHeaders,
        body: responseBody,
        isJson,
      });
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? t('apiDebug.networkTimeout')
          : err instanceof Error
            ? err.message
            : t('apiDebug.networkError');
      setResult({
        status: 0,
        durationMs,
        headers: {},
        body: '',
        isJson: false,
        error: message,
      });
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  };

  const statusColor = (status: number) => {
    if (status === 0) return 'text-destructive';
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
    if (status === 401 || status === 403) return 'text-destructive';
    if (status === 502) return 'text-orange-600 dark:text-orange-400';
    if (status >= 400) return 'text-destructive';
    return 'text-foreground';
  };

  const rateLimitHeaders = result
    ? RATE_LIMIT_HEADERS.filter((h) => result.headers[h]).map((h) => [h, result.headers[h]] as const)
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbApiDebug')}
        title={t('dashboard.apiDebugTitle')}
        subtitle={t('dashboard.apiDebugSubtitle')}
      />

      <section className="border rounded-lg p-4 bg-card space-y-3">
        <h2 className="text-sm font-semibold">{t('apiDebug.tokenSection')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('apiDebug.baseUrl')}: <code className="font-mono">{baseUrl}</code>
        </p>

        {!useManualToken ? (
          <div className="space-y-2">
            {autoToken ? (
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs break-all bg-muted p-2 rounded font-mono">
                  {autoToken.slice(0, 8)}…{autoToken.slice(-4)}
                </code>
                <span className="text-xs text-green-600 dark:text-green-400 shrink-0 pt-2">
                  {t('apiDebug.tokenLoaded')}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('apiDebug.tokenMissing')}{' '}
                <Link to="/dashboard/api-keys" className="text-primary hover:underline">
                  {t('dashboard.apiKeys')}
                </Link>
              </p>
            )}
            <button
              type="button"
              onClick={() => setUseManualToken(true)}
              className="text-xs text-primary hover:underline"
            >
              {t('apiDebug.useManualToken')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder={t('apiDebug.manualTokenPlaceholder')}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => {
                setUseManualToken(false);
                setManualToken('');
              }}
              className="text-xs text-primary hover:underline"
            >
              {t('apiDebug.useAutoToken')}
            </button>
          </div>
        )}
      </section>

      <section className="border rounded-lg p-4 bg-card space-y-4">
        <div>
          <label htmlFor="endpoint-select" className="text-sm font-semibold block mb-2">
            {t('apiDebug.endpointLabel')}
          </label>
          <select
            id="endpoint-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          >
            {API_DEBUG_CATEGORIES.map((cat) => {
              const items = endpointsByCategory.get(cat) ?? [];
              if (items.length === 0) return null;
              return (
                <optgroup key={cat} label={t(cat)}>
                  {items.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.method} {ep.pathTemplate}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        {endpointMeta && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t(endpointMeta.titleKey)}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t(endpointMeta.descriptionKey)}</p>
              <p className="text-xs text-muted-foreground mt-2 italic">{t(endpointMeta.usageHintKey)}</p>
            </div>

            {paramRows.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('apiDebug.paramsReference')}</p>
                <ApiEndpointParamTable rows={paramRows} />
              </div>
            )}

            <p className="text-xs">
              <Link to={getDocsHref(endpoint.id)} className="text-primary hover:underline">
                {t('apiDebug.viewFullDocs')}
              </Link>
            </p>
          </div>
        )}

        {endpoint.fields.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('apiDebug.paramsLabel')}</p>
            {endpoint.fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={`field-${field.name}`} className="text-xs text-muted-foreground block mb-1">
                  {field.kind === 'path' && t('apiDebug.pathParam')}
                  {field.kind === 'query' && t('apiDebug.queryParam')}
                  {field.kind === 'body' && t('apiDebug.bodyParam')}{' '}
                  <span className="font-mono text-foreground">{field.name}</span>
                  {field.required && <span className="text-destructive"> *</span>}
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">{t(fieldDescriptionKey(endpoint.id, field))}</p>
                {field.type === 'boolean' ? (
                  <select
                    id={`field-${field.name}`}
                    value={fieldValues[field.name] ?? 'true'}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    id={`field-${field.name}`}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={fieldValues[field.name] ?? ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-full sm:w-auto"
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin" />
              {t('apiDebug.sending')}
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane" />
              {t('apiDebug.send')}
            </>
          )}
        </button>
      </section>

      {result && (
        <section className="border rounded-lg p-4 bg-card space-y-4">
          <h2 className="text-sm font-semibold">{t('apiDebug.responseSection')}</h2>

          {result.error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {result.error}
            </div>
          )}

          {result.status > 0 && (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('apiDebug.status')}: </span>
                  <span className={`font-mono font-semibold ${statusColor(result.status)}`}>
                    {result.status}
                    {result.status === 401 && ` — ${t('apiDebug.error401')}`}
                    {result.status === 502 && ` — ${t('apiDebug.error502')}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('apiDebug.duration')}: </span>
                  <span className="font-mono">{result.durationMs} ms</span>
                </div>
              </div>

              {rateLimitHeaders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('apiDebug.rateLimitHeaders')}</p>
                  <div className="bg-muted rounded-md p-2 text-xs font-mono space-y-0.5">
                    {rateLimitHeaders.map(([key, val]) => (
                      <div key={key}>
                        {key}: {val}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.body && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('apiDebug.responseBody')}</p>
                  <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs leading-relaxed max-h-[480px] overflow-y-auto">
                    <code className="font-mono">{result.body}</code>
                  </pre>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="border rounded-lg p-4 bg-card">
        <h2 className="text-sm font-semibold mb-2">{t('apiDebug.supportedEndpoints')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-3 font-medium">{t('apiUsage.colMethod')}</th>
                <th className="text-left py-2 pr-3 font-medium">{t('apiUsage.colPath')}</th>
                <th className="hidden lg:table-cell text-left py-2 font-medium">{t('apiUsage.colDescription')}</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {API_DEBUG_ENDPOINTS.map((ep) => (
                <tr key={ep.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono text-foreground">{ep.method}</td>
                  <td className="py-2 pr-3 font-mono">{ep.pathTemplate}</td>
                  <td className="hidden lg:table-cell py-2 font-sans">{t(getEndpointDescriptionKey(ep.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          <a href="/api-docs" className="text-primary hover:underline">
            {t('apiUsage.viewFullDocs')}
          </a>
        </p>
      </section>
    </div>
  );
};

export default ApiDebugPage;
