import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createUserExtractRule,
  deleteUserExtractRule,
  ExtractRuleItem,
  GlobalExtractRuleItem,
  getUserExtractRules,
  stripSeedRemarkPrefix,
  updateUserExtractRule,
} from '../utils/api';

const emptyForm = {
  domain: '*',
  regex: '',
  priority: 0,
  enabled: true,
  remark: '',
};

interface ExtractRuleManagerProps {
  prefillDomain?: string | null;
}

const ExtractRuleManager: React.FC<ExtractRuleManagerProps> = ({ prefillDomain }) => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<ExtractRuleItem[]>([]);
  const [globalRules, setGlobalRules] = useState<GlobalExtractRuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUserExtractRules();
      if (result.success) {
        setRules(result.rules);
        setGlobalRules(result.globalRules);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    if (!prefillDomain) return;
    setForm((f) => ({ ...f, domain: prefillDomain }));
    setEditingId(null);
    setShowForm(true);
    setError('');
  }, [prefillDomain]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleEdit = (rule: ExtractRuleItem) => {
    setEditingId(rule.id);
    setForm({
      domain: rule.domain,
      regex: rule.regex,
      priority: rule.priority,
      enabled: rule.enabled,
      remark: rule.remark || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.regex.trim()) {
      setError(t('extractRules.regexRequired'));
      return;
    }

    const payload = {
      domain: form.domain.trim() || '*',
      regex: form.regex.trim(),
      priority: form.priority,
      enabled: form.enabled,
      remark: form.remark.trim() || null,
    };

    const result = editingId
      ? await updateUserExtractRule(editingId, payload)
      : await createUserExtractRule(payload);

    if (result.success) {
      resetForm();
      loadRules();
    } else {
      setError(result.error || t('extractRules.saveFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('extractRules.confirmDelete'))) return;
    const result = await deleteUserExtractRule(id);
    if (result.success) loadRules();
  };

  const handleToggleEnabled = async (rule: ExtractRuleItem) => {
    const result = await updateUserExtractRule(rule.id, {
      domain: rule.domain,
      regex: rule.regex,
      priority: rule.priority,
      enabled: !rule.enabled,
      remark: rule.remark,
    });
    if (result.success) loadRules();
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 bg-card">
        <h2 className="font-semibold mb-1">{t('extractRules.builtinTitle')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('extractRules.builtinDesc')}</p>
        {globalRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('extractRules.noGlobalRules')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('extractRules.colDomain')}</th>
                  <th className="hidden sm:table-cell py-2 pr-3 font-medium">{t('extractRules.colDescription')}</th>
                  <th className="py-2 pr-3 font-medium">{t('extractRules.colRegex')}</th>
                  <th className="hidden md:table-cell py-2 pr-3 font-medium">{t('extractRules.colPriority')}</th>
                  <th className="py-2 font-medium">{t('extractRules.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {globalRules.map((rule) => (
                  <tr key={rule.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{rule.domain}</td>
                    <td className="hidden sm:table-cell py-2 pr-3 text-muted-foreground">
                      {stripSeedRemarkPrefix(rule.remark)}
                    </td>
                    <td className="py-2 pr-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{rule.regex}</code>
                    </td>
                    <td className="hidden md:table-cell py-2 pr-3">{rule.priority}</td>
                    <td className="py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          rule.enabled
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {rule.enabled ? t('extractRules.statusEnabled') : t('extractRules.statusDisabled')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-semibold">{t('extractRules.customTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('extractRules.customDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="text-sm px-4 py-2 min-h-10 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 shrink-0 w-full sm:w-auto"
          >
            {t('extractRules.addRule')}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-4 p-3 border rounded-md space-y-3">
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="rule-domain" className="text-sm font-medium block mb-1">
                  {t('extractRules.colDomain')}
                </label>
                <input
                  id="rule-domain"
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder={t('extractRules.domainPlaceholder')}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                />
              </div>
              <div>
                <label htmlFor="rule-priority" className="text-sm font-medium block mb-1">
                  {t('extractRules.colPriority')}
                </label>
                <input
                  id="rule-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="rule-regex" className="text-sm font-medium block mb-1">
                {t('extractRules.colRegex')}
              </label>
              <input
                id="rule-regex"
                type="text"
                value={form.regex}
                onChange={(e) => setForm((f) => ({ ...f, regex: e.target.value }))}
                placeholder={t('extractRules.regexPlaceholder')}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="rule-remark" className="text-sm font-medium block mb-1">
                {t('extractRules.colRemark')}
              </label>
              <input
                id="rule-remark"
                type="text"
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                placeholder={t('extractRules.remarkPlaceholder')}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              {t('extractRules.enabled')}
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="text-sm px-4 py-2 min-h-10 bg-primary text-primary-foreground rounded-md">
                {editingId ? t('common.save') : t('common.create')}
              </button>
              <button type="button" onClick={resetForm} className="text-sm px-4 py-2 min-h-10 border rounded-md">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('extractRules.noCustomRules')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('extractRules.colDomain')}</th>
                  <th className="py-2 pr-3 font-medium">{t('extractRules.colRegex')}</th>
                  <th className="hidden sm:table-cell py-2 pr-3 font-medium">{t('extractRules.colPriority')}</th>
                  <th className="hidden md:table-cell py-2 pr-3 font-medium">{t('extractRules.colRemark')}</th>
                  <th className="py-2 pr-3 font-medium">{t('extractRules.colStatus')}</th>
                  <th className="py-2 font-medium">{t('extractRules.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{rule.domain}</td>
                    <td className="py-2 pr-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{rule.regex}</code>
                    </td>
                    <td className="hidden sm:table-cell py-2 pr-3">{rule.priority}</td>
                    <td className="hidden md:table-cell py-2 pr-3 text-muted-foreground">{rule.remark || '-'}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(rule)}
                        className={`text-xs px-2 py-1 min-h-8 rounded-full ${
                          rule.enabled
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {rule.enabled ? t('extractRules.statusEnabled') : t('extractRules.statusDisabled')}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(rule)}
                          className="text-xs text-primary hover:underline min-h-8 px-1"
                        >
                          {t('extractRules.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule.id)}
                          className="text-xs text-destructive hover:underline min-h-8 px-1"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtractRuleManager;
