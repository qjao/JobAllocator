import React, { useState, useEffect } from 'react';
import { CalendarIcon, LogOut, Search, Train, Shield, User as UserIcon, HelpCircle, Sun, Moon, AlertTriangle, ChevronRight, Navigation, Copy } from 'lucide-react';
import { User } from '../types';
import HelpModal from './HelpModal';

interface FindJobsProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar' | 'find-jobs') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface TrainService {
  std: string;
  date: string;
  etd: string;
  platform: string;
  operator: string;
  destination: string;
  headcode: string;
}

const ELIZABETH_LINE_STATIONS = [
  { crs: 'ABW', name: 'Abbey Wood' },
  { crs: 'WWC', name: 'Woolwich' },
  { crs: 'CUS', name: 'Custom House' },
  { crs: 'CWX', name: 'Canary Wharf' },
  { crs: 'ZLW', name: 'Whitechapel' },
  { crs: 'SRA', name: 'Stratford (London)' },
  { crs: 'MYL', name: 'Maryland' },
  { crs: 'FOG', name: 'Forest Gate' },
  { crs: 'MNP', name: 'Manor Park' },
  { crs: 'IFD', name: 'Ilford' },
  { crs: 'SVK', name: 'Seven Kings' },
  { crs: 'GMY', name: 'Goodmayes' },
  { crs: 'CTH', name: 'Chadwell Heath' },
  { crs: 'RMF', name: 'Romford' },
  { crs: 'GDP', name: 'Gidea Park' },
  { crs: 'HRO', name: 'Harold Wood' },
  { crs: 'BRE', name: 'Brentwood' },
  { crs: 'SNF', name: 'Shenfield' },
  { crs: 'LST', name: 'Liverpool Street' },
  { crs: 'ZFD', name: 'Farringdon' },
  { crs: 'TCR', name: 'Tottenham Court Road' },
  { crs: 'BDS', name: 'Bond Street' },
  { crs: 'PAD', name: 'Paddington' },
  { crs: 'EAL', name: 'Ealing Broadway' },
  { crs: 'STL', name: 'Southall' },
  { crs: 'HAY', name: 'Hayes & Harlington' },
  { crs: 'HXX', name: 'Heathrow Central' },
  { crs: 'HAF', name: 'Heathrow Terminal 4' },
  { crs: 'HWV', name: 'Heathrow Terminal 5' },
  { crs: 'WDT', name: 'West Drayton' },
  { crs: 'IVR', name: 'Iver' },
  { crs: 'LNY', name: 'Langley' },
  { crs: 'SLO', name: 'Slough' },
  { crs: 'BNM', name: 'Burnham' },
  { crs: 'TAP', name: 'Taplow' },
  { crs: 'MAI', name: 'Maidenhead' },
  { crs: 'TWY', name: 'Twyford' },
  { crs: 'RDG', name: 'Reading' },
].sort((a, b) => a.name.localeCompare(b.name));

import Header from './Header';

export default function FindJobs({ user, onLogout, onNavigate, darkMode, toggleDarkMode }: FindJobsProps) {
  const [crs, setCrs] = useState('PAD');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [filterCrs, setFilterCrs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<TrainService[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    request?: string, 
    response?: string,
    cacheStats?: {
      cachedServicesFound: number;
      apiRequestsMade: number;
      timeOfLastSearch?: string;
      cachedTimeRange?: {
        start: string;
        end: string;
      } | null;
      rateLimit?: {
        used: number;
        limit: number;
      };
    }
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
    setHour(String(now.getHours()).padStart(2, '0'));
    setMinute(String(now.getMinutes()).padStart(2, '0'));
  }, []);

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/nre/cache/clear', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDebugInfo(null);
        setHasSearched(false);
        setServices([]);
        setError('');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to clear cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCrs = crs.trim().toUpperCase();
    if (cleanCrs.length !== 3) {
      setError('CRS code must be exactly 3 letters.');
      return;
    }
    const cleanFilterCrs = filterCrs.trim().toUpperCase();
    if (cleanFilterCrs && cleanFilterCrs.length !== 3) {
      setError('Calling At CRS code must be exactly 3 letters if provided.');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);
    setServices([]);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('crs', cleanCrs);
      if (date && hour && minute) {
        params.append('time', `${date}T${hour}:${minute}:00`);
      }
      if (cleanFilterCrs) params.append('filterCrs', cleanFilterCrs);

      const res = await fetch(`/api/nre/departures?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.debug) {
        setDebugInfo(data.debug);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch departures.');
      }

      setServices(data.services || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching departures.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Header
        user={user}
        currentView="find-jobs"
        onNavigate={onNavigate as any}
        onLogout={onLogout}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onHelp={() => setShowHelpModal(true)}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Find Jobs (Live Departures)</h1>
          <p className="text-slate-600 dark:text-slate-400">Search for live train departures from any station to find headcodes.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-end gap-2 sm:gap-3">
            <div className="flex-1 w-full sm:w-auto min-w-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">Station From</label>
              <select
                value={crs}
                onChange={(e) => setCrs(e.target.value)}
                className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-[13px] appearance-none"
                required
              >
                <option value="" disabled>Select station...</option>
                {ELIZABETH_LINE_STATIONS.map((station) => (
                  <option key={station.crs} value={station.crs}>
                    {station.name} ({station.crs})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 w-full sm:w-auto min-w-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">Calling At</label>
              <select
                value={filterCrs}
                onChange={(e) => setFilterCrs(e.target.value)}
                className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-[13px] appearance-none"
                required
              >
                <option value="" disabled>Select station...</option>
                {ELIZABETH_LINE_STATIONS.map((station) => (
                  <option key={station.crs} value={station.crs}>
                    {station.name} ({station.crs})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full sm:w-[115px] px-1.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-sm"
                  required
                />
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="w-12 px-1 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-sm appearance-none text-center"
                  required
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="self-center font-bold text-slate-500">:</span>
                <select
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  className="w-12 px-1 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-sm appearance-none text-center"
                  required
                >
                  {Array.from({ length: 60 }).map((_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || crs.length !== 3}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 h-[42px] w-full sm:w-auto"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Search</span>
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400 text-sm transition-colors">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error fetching departures</p>
                <p>{error}</p>
                {error.includes('NRE_STAFF_TOKEN') && (
                  <p className="mt-2 text-xs opacity-80">
                    The server needs an NRE_STAFF_TOKEN environment variable configured to access the National Rail Enquiries OpenLDBWS API.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {hasSearched && !loading && !error && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
            {services.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <Navigation className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">No departures found</p>
                <p>There are currently no departures from this station, or the CRS code is invalid.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Departs</th>
                      <th className="px-4 py-3 font-medium">Destination</th>
                      <th className="px-4 py-3 font-medium">Platform</th>
                      <th className="px-4 py-3 font-medium">Headcode</th>
                      <th className="px-4 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {services.map((service, index) => (
                      <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{service.std}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={service.destination}>
                          {service.destination}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-center">{service.platform}</td>
                        <td className="px-4 py-3">
                          <a 
                            href={`https://tdtools.co.uk/roster/headcode.php?action=headcode-list&date=${service.date}&headcode=${service.headcode}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:text-blue-600 hover:border-blue-400 font-mono text-xs font-semibold px-2 py-1 rounded transition-colors"
                          >
                            {service.headcode}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${
                            service.etd === 'On time' 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : service.etd === 'Cancelled' 
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {service.etd}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(user.role === 'admin' || user.role === 'moderator') && debugInfo && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors mt-8">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="w-full px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" />
                Admin Debug Info
              </h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {showDebug ? 'Hide' : 'Show'}
              </span>
            </button>
            {showDebug && (
              <div className="p-6 space-y-4">
                {debugInfo.cacheStats && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                      <span>Cache Statistics</span>
                      {debugInfo.cacheStats.timeOfLastSearch && (
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          Last searched: {new Date(debugInfo.cacheStats.timeOfLastSearch).toLocaleString()}
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Services from Cache: </span>
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{debugInfo.cacheStats.cachedServicesFound}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">API Requests Made: </span>
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{debugInfo.cacheStats.apiRequestsMade}</span>
                      </div>
                      {debugInfo.cacheStats.rateLimit && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 dark:text-slate-400">Global API Usage (Past Hour): </span>
                          <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                            {debugInfo.cacheStats.rateLimit.used} / {debugInfo.cacheStats.rateLimit.limit}
                          </span>
                        </div>
                      )}
                      {debugInfo.cacheStats.cachedTimeRange && (
                        <div className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400 italic">
                          Cached items from {debugInfo.cacheStats.cachedTimeRange.start} to {debugInfo.cacheStats.cachedTimeRange.end}.
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                      <button
                        onClick={handleClearCache}
                        disabled={clearingCache}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {clearingCache ? 'Clearing...' : 'Clear Cache'}
                      </button>
                    </div>
                  </div>
                )}
                {debugInfo.request && (
                  <div className="relative group">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Raw Request</h3>
                      <button 
                        onClick={() => navigator.clipboard.writeText(debugInfo.request || '')}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-[300px] text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap border border-slate-200 dark:border-slate-800">
                      {debugInfo.request}
                    </pre>
                  </div>
                )}
                {debugInfo.response && (
                  <div className="relative group">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Raw Response</h3>
                      <button 
                        onClick={() => navigator.clipboard.writeText(debugInfo.response || '')}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-[300px] text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap border border-slate-200 dark:border-slate-800">
                      {debugInfo.response}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}
