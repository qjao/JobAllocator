import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Check, ShieldCheck, Loader2, AlertCircle, Key, Train, RefreshCw, RotateCcw, ArrowRightLeft } from 'lucide-react';

interface NREConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

interface TestResultState {
  success: boolean;
  responseTimeMs?: number;
  status?: number;
  locationName?: string;
  serviceCount?: number;
  sampleServices?: string[];
  error?: string;
}

const DEFAULT_DEPARTURE_URL = 'https://api1.raildata.org.uk/1010-live-departure-board---staff-version1_0/LDBSVWS/api/20220120';
const DEFAULT_ARRIVAL_URL = 'https://api1.raildata.org.uk/1010-live-arrival-board---staff-version1_0/LDBSVWS/api/20220120';

export default function NREConfigModal({ isOpen, onClose, isAdmin }: NREConfigModalProps) {
  // Departure Board state
  const [url, setUrl] = useState(DEFAULT_DEPARTURE_URL);
  const [defaultUrl, setDefaultUrl] = useState(DEFAULT_DEPARTURE_URL);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [savingDeparture, setSavingDeparture] = useState(false);
  const [departureSuccess, setDepartureSuccess] = useState(false);
  const [departureError, setDepartureError] = useState<string | null>(null);
  const [departureTestResult, setDepartureTestResult] = useState<TestResultState | null>(null);

  // Arrival Board state
  const [arrivalUrl, setArrivalUrl] = useState(DEFAULT_ARRIVAL_URL);
  const [defaultArrivalUrl, setDefaultArrivalUrl] = useState(DEFAULT_ARRIVAL_URL);
  const [arrivalApiKey, setArrivalApiKey] = useState('');
  const [arrivalApiKeyPreview, setArrivalApiKeyPreview] = useState('');
  const [hasArrivalApiKey, setHasArrivalApiKey] = useState(false);
  const [savingArrival, setSavingArrival] = useState(false);
  const [arrivalSuccess, setArrivalSuccess] = useState(false);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [arrivalTestResult, setArrivalTestResult] = useState<TestResultState | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    setDepartureError(null);
    setArrivalError(null);
    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/settings/nre', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url || data.defaultUrl || DEFAULT_DEPARTURE_URL);
        if (data.defaultUrl) setDefaultUrl(data.defaultUrl);
        setHasApiKey(Boolean(data.hasApiKey));
        setApiKeyPreview(data.apiKeyPreview || '');

        setArrivalUrl(data.arrivalUrl || data.defaultArrivalUrl || DEFAULT_ARRIVAL_URL);
        if (data.defaultArrivalUrl) setDefaultArrivalUrl(data.defaultArrivalUrl);
        setHasArrivalApiKey(Boolean(data.hasArrivalApiKey));
        setArrivalApiKeyPreview(data.arrivalApiKeyPreview || '');
      }
    } catch (e: any) {
      console.warn('Failed to load Rail Data API settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAndSaveDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDeparture(true);
    setDepartureSuccess(false);
    setDepartureError(null);
    setDepartureTestResult(null);

    const targetUrl = url.trim() || defaultUrl;
    const targetKey = apiKey.trim();

    if (!targetKey && !hasApiKey) {
      setDepartureError('Please enter your Live Departure Board Consumer API key.');
      setSavingDeparture(false);
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/settings/nre/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          board: 'departure',
          url: targetUrl,
          apiKey: targetKey || undefined,
          saveOnSuccess: true
        })
      });

      const data = await res.json();
      setDepartureTestResult(data);

      if (data.success) {
        setDepartureSuccess(true);
        setApiKey('');
        await loadSettings();
        setTimeout(() => setDepartureSuccess(false), 4000);
      } else {
        setDepartureError(data.error || 'Failed to connect to Rail Data Live Departure Board API.');
      }
    } catch (e: any) {
      setDepartureError(e.message || 'Error communicating with server');
    } finally {
      setSavingDeparture(false);
    }
  };

  const handleTestAndSaveArrival = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingArrival(true);
    setArrivalSuccess(false);
    setArrivalError(null);
    setArrivalTestResult(null);

    const targetUrl = arrivalUrl.trim() || defaultArrivalUrl;
    const targetKey = arrivalApiKey.trim();

    if (!targetKey && !hasArrivalApiKey) {
      setArrivalError('Please enter your Live Arrival Board Consumer API key.');
      setSavingArrival(false);
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      const res = await fetch('/api/settings/nre/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          board: 'arrival',
          arrivalUrl: targetUrl,
          arrivalApiKey: targetKey || undefined,
          saveOnSuccess: true
        })
      });

      const data = await res.json();
      setArrivalTestResult(data);

      if (data.success) {
        setArrivalSuccess(true);
        setArrivalApiKey('');
        await loadSettings();
        setTimeout(() => setArrivalSuccess(false), 4000);
      } else {
        setArrivalError(data.error || 'Failed to connect to Rail Data Live Arrival Board API.');
      }
    } catch (e: any) {
      setArrivalError(e.message || 'Error communicating with server');
    } finally {
      setSavingArrival(false);
    }
  };

  if (!isOpen) return null;

  const renderTestResultCard = (result: TestResultState | null, sampleTitle: string) => {
    if (!result) return null;
    return (
      <div className={`mt-3 p-3.5 rounded-xl border text-xs space-y-2.5 ${
        result.success
          ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          : 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
      }`}>
        <div className="flex items-center justify-between font-bold pb-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {result.success ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">Connection Verified (HTTP {result.status})</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>Connection Check Failed</span>
              </>
            )}
          </div>
          {result.responseTimeMs !== undefined && (
            <span className="text-[11px] font-mono text-slate-500">{result.responseTimeMs}ms</span>
          )}
        </div>

        {result.success && (
          <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span>Station Tested:</span>
              <strong className="text-slate-900 dark:text-slate-100">{result.locationName || 'London Paddington (PAD)'}</strong>
            </div>
            <div className="flex justify-between">
              <span>Elizabeth Line (XR) Services Returned:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">{result.serviceCount ?? 0}</strong>
            </div>
            {result.sampleServices && result.sampleServices.length > 0 && (
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                <div className="font-semibold text-slate-700 dark:text-slate-300">{sampleTitle}:</div>
                {result.sampleServices.map((item, idx) => (
                  <div key={idx}>• {item}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Rail Data Live Boards API
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configures the JSON LDBSVWS staff API endpoints and <code className="font-mono">x-apikey</code> keys used by Find Jobs.
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
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* 1. Live Departure Board API */}
              <form onSubmit={handleTestAndSaveDeparture} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Train className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      1. Live Departure Board API
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Used for station-to-station and station-to-depot departure searches.
                    </p>
                  </div>
                  {hasApiKey && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Active ({apiKeyPreview})
                    </span>
                  )}
                </div>

                {departureSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Departure API key verified & saved! Live cache cleared.</span>
                  </div>
                )}

                {departureError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span className="break-words">{departureError}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Departure API Base URL
                    </label>
                    {url.trim() !== defaultUrl && isAdmin && (
                      <button
                        type="button"
                        onClick={() => setUrl(defaultUrl)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={defaultUrl}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Key className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Departure API Key (<code className="font-mono">x-apikey</code>)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasApiKey ? 'Enter new Departure API key to overwrite...' : 'Paste Consumer Key for Live Departure Board - Staff Version'}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={savingDeparture || !isAdmin || (!apiKey.trim() && !hasApiKey)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {savingDeparture ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Save & Test Departure API</span>
                  </button>
                </div>

                {renderTestResultCard(departureTestResult, 'Sample Live Departures')}
              </form>

              {/* 2. Live Arrival Board API */}
              <form onSubmit={handleTestAndSaveArrival} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      2. Live Arrival Board API (Depot Origin Reverse Lookup)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Used via <code className="font-mono">GetArrivalBoardByTIPLOC</code> when searching from a depot/siding origin (e.g. Old Oak Depot → Paddington).
                    </p>
                  </div>
                  {hasArrivalApiKey && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Active ({arrivalApiKeyPreview})
                    </span>
                  )}
                </div>

                {arrivalSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Arrival API key verified & saved! Live cache cleared.</span>
                  </div>
                )}

                {arrivalError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span className="break-words">{arrivalError}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Arrival API Base URL
                    </label>
                    {arrivalUrl.trim() !== defaultArrivalUrl && isAdmin && (
                      <button
                        type="button"
                        onClick={() => setArrivalUrl(defaultArrivalUrl)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    value={arrivalUrl}
                    onChange={(e) => setArrivalUrl(e.target.value)}
                    placeholder={defaultArrivalUrl}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Key className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Arrival API Key (<code className="font-mono">x-apikey</code>)
                  </label>
                  <input
                    type="password"
                    value={arrivalApiKey}
                    onChange={(e) => setArrivalApiKey(e.target.value)}
                    placeholder={hasArrivalApiKey ? 'Enter new Arrival API key to overwrite...' : 'Paste Consumer Key for Live Arrival Board - Staff Version'}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={savingArrival || !isAdmin || (!arrivalApiKey.trim() && !hasArrivalApiKey)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {savingArrival ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Save & Test Arrival API</span>
                  </button>
                </div>

                {renderTestResultCard(arrivalTestResult, 'Sample Live Arrivals')}
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
