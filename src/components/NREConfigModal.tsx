import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Check,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Key,
  Train,
  RefreshCw,
  Database,
  Globe,
  Trash2,
} from 'lucide-react';

interface NREConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

interface RemoteApiStatus {
  configured: boolean;
  apiUrlPreview: string;
  candidateHeadcodesCount: number;
  cachedDates: Array<{
    date: string;
    headcodeCount: number;
    scheduleCount: number;
    fetchedAt: string;
  }>;
  lastQueryAt: string | null;
  lastQueryDurationMs: number | null;
  lastError: string | null;
  supportsDeparturesEndpoint: boolean | null;
}

interface TestResultState {
  success: boolean;
  responseTimeMs?: number;
  status?: number;
  trainsCount?: number;
  sampleServices?: string[];
  error?: string;
}

export default function NREConfigModal({ isOpen, onClose, isAdmin }: NREConfigModalProps) {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [status, setStatus] = useState<RemoteApiStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResultState | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/settings/nr', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url || '');
        setHasApiKey(Boolean(data.hasApiKey));
        setApiKeyPreview(data.apiKeyPreview || '');
        setStatus(data.status || null);
      }
    } catch (e: any) {
      console.warn('Failed to load Live Train API settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setErrorMsg(null);
    setTestResult(null);

    if (!url.trim()) {
      setErrorMsg('Please enter your Live Train API Base URL (e.g. https://your-host.example.com).');
      setSaving(false);
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/settings/nr/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: url.trim(),
          apiKey: apiKey.trim() || undefined,
          saveOnSuccess: true,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.feedStatus && typeof data.feedStatus === 'object') {
        setStatus(data.feedStatus);
      } else if (data.status && typeof data.status === 'object') {
        setStatus(data.status);
      }

      if (data.success) {
        setSaveSuccess('API connection verified & saved! Schedule cache reset.');
        setApiKey('');
        await loadSettings();
        setTimeout(() => setSaveSuccess(null), 5000);
      } else {
        setErrorMsg(data.error || 'Failed to connect to the remote Live Train API.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error communicating with server');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    setErrorMsg(null);
    setSaveSuccess(null);
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/nr/cache/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      if (res.ok) {
        setSaveSuccess('Cached schedule entries cleared.');
        setTimeout(() => setSaveSuccess(null), 3500);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Live Train API (Docker Feed)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Retrieves stored Network Rail TRUST, VSTP & Schedule data from your API via HTTP <code className="font-mono">/api/live</code> + <code className="font-mono">x-api-key</code>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Remote Status Card */}
              {status && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Connection & Cache Overview</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${
                        status.configured
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
                      }`}
                    >
                      {status.configured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white dark:bg-slate-900/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Cached Schedule Dates</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {status.cachedDates.length}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Catalog Headcodes</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {status.candidateHeadcodesCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Last Query Latency</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {status.lastQueryDurationMs !== null ? `${status.lastQueryDurationMs}ms` : '—'}
                      </div>
                    </div>
                  </div>

                  {status.lastError && (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-700 dark:text-red-300 font-mono break-all">
                      Last Error: {status.lastError}
                    </div>
                  )}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleTestAndSave} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Remote Endpoint & API Key
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      No STOMP connection is opened by this app — queries go strictly over HTTPS to your server.
                    </p>
                  </div>
                  {hasApiKey && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Key Saved ({apiKeyPreview})
                    </span>
                  )}
                </div>

                {saveSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span className="break-words">{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Live Train API URL (<code className="font-mono">NR_LIVE_API_URL</code>)
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-api-domain.example.com"
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Enter either the base URL (e.g. <code className="font-mono">https://host.com</code>) or full <code className="font-mono">/api/live</code> endpoint.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Key className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    API Key (<code className="font-mono">x-api-key</code> / <code className="font-mono">API_SECRET_KEY</code>)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasApiKey ? 'Enter new API key to overwrite...' : 'Paste your API_SECRET_KEY (optional if unset on remote)'}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving || !isAdmin || !url.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Save & Test Connection</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCache}
                    disabled={clearing || !isAdmin}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{clearing ? 'Clearing...' : 'Clear Schedule Cache'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`mt-3 p-3.5 rounded-xl border text-xs space-y-2.5 ${
                      testResult.success
                        ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                        : 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold pb-2 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Connection Verified
                              {(typeof testResult.status === 'number' || typeof testResult.status === 'string')
                                ? ` (HTTP ${testResult.status})`
                                : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span>Connection Check Failed</span>
                          </>
                        )}
                      </div>
                      {testResult.responseTimeMs !== undefined && (
                        <span className="text-[11px] font-mono text-slate-500">{testResult.responseTimeMs}ms</span>
                      )}
                    </div>

                    {testResult.success && (
                      <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 font-mono">
                        <div className="flex justify-between">
                          <span>Matched Sample Headcodes:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {testResult.trainsCount ?? 0}
                          </strong>
                        </div>
                        {testResult.sampleServices && testResult.sampleServices.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                              Sample Services from Your Database:
                            </div>
                            {testResult.sampleServices.map((item, idx) => (
                              <div key={idx}>• {item}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
