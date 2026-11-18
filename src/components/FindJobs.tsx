import React, { useState, useEffect } from 'react';
import {
  Search,
  Train,
  Shield,
  AlertTriangle,
  Navigation,
  Copy,
  Globe,
  RefreshCw,
  Trash2,
  Database,
} from 'lucide-react';
import { User } from '../types';
import { formatDateKey, getLondonDate } from '../lib/utils';
import Header from './Header';
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
  arrAtDest?: string;
  date: string;
  etd: string;
  platform: string;
  operator: string;
  operatorCode?: string;
  destination: string;
  destinationTiploc?: string;
  headcode: string;
  isPassengerService?: boolean;
  stpIndicator?: string;
  trainUid?: string;
  activated?: boolean;
  lastLocation?: string | null;
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

const ELIZABETH_LINE_LOCATIONS = [
  // Operational Depots, Sidings & Turnbacks
  { tiploc: 'MDNHDRS', name: 'Maidenhead Turnback' },
  { tiploc: 'OLDOENG', name: 'Old Oak Engine Sdg' },
  { tiploc: 'ROYAOSD', name: 'Royal Oak Sidings' },
  { tiploc: 'OLDOXRS', name: 'Old Oak Depot' },
  { tiploc: 'MDNHDCS', name: 'Maidenhead CS' },
  { tiploc: 'GIDEPKS', name: 'Gidea Park CS' },
  { tiploc: 'GIDECES', name: 'Gidea Pk C/E Spur' },
  { tiploc: 'SHENFMS', name: 'Shenfield CS' },
  { tiploc: 'ILFEMUD', name: 'Ilford E.M.U.D.' },
  { tiploc: 'WBRNPKS', name: 'Westbourne Park Sidings' },
  { tiploc: 'WEALEMU', name: 'West Ealing EMUD' },
  { tiploc: 'ABWDXRS', name: 'Abbey Wood Sidings' },
  { tiploc: 'PLMSXCR', name: 'Plumstead CS' },
  // Stations with both CRS and TIPLOC
  { crs: 'ABW', tiploc: 'ABWDXR', name: 'Abbey Wood' },
  { crs: 'WWC', tiploc: 'WOLWXR', name: 'Woolwich' },
  { crs: 'CUS', tiploc: 'CUSTMHS', name: 'Custom House' },
  { crs: 'CWX', tiploc: 'CANWHRF', name: 'Canary Wharf' },
  { crs: 'ZLW', tiploc: 'WCHAPXR', name: 'Whitechapel' },
  { crs: 'SRA', tiploc: 'STFD', name: 'Stratford (London)' },
  { crs: 'MYL', tiploc: 'MRYLAND', name: 'Maryland' },
  { crs: 'FOG', tiploc: 'FRSTGT', name: 'Forest Gate' },
  { crs: 'MNP', tiploc: 'MANRPK', name: 'Manor Park' },
  { crs: 'IFD', tiploc: 'ILFORD', name: 'Ilford' },
  { crs: 'SVK', tiploc: 'SVNKNGS', name: 'Seven Kings' },
  { crs: 'GMY', tiploc: 'GODMAYS', name: 'Goodmayes' },
  { crs: 'CTH', tiploc: 'CHDWLHT', name: 'Chadwell Heath' },
  { crs: 'RMF', tiploc: 'ROMFORD', name: 'Romford' },
  { crs: 'GDP', tiploc: 'GIDEAPK', name: 'Gidea Park' },
  { crs: 'HRO', tiploc: 'HRLDWOD', name: 'Harold Wood' },
  { crs: 'BRE', tiploc: 'BRTWOOD', name: 'Brentwood' },
  { crs: 'SNF', tiploc: 'SHENFLD', name: 'Shenfield' },
  { crs: 'LST', tiploc: 'LIVSTLL', name: 'Liverpool Street' },
  { crs: 'ZFD', tiploc: 'FRNDXR', name: 'Farringdon' },
  { crs: 'TCR', tiploc: 'TOTCTRD', name: 'Tottenham Court Road' },
  { crs: 'BDS', tiploc: 'BONDST', name: 'Bond Street' },
  { crs: 'PAD', tiploc: 'PADTLL', name: 'Paddington LL' },
  { crs: 'AML', tiploc: 'ACTONML', name: 'Acton Main Line' },
  { crs: 'EAL', tiploc: 'EALINGB', name: 'Ealing Broadway' },
  { crs: 'WEA', tiploc: 'WEALING', name: 'West Ealing' },
  { crs: 'HAN', tiploc: 'HANWELL', name: 'Hanwell' },
  { crs: 'STL', tiploc: 'STHALL', name: 'Southall' },
  { crs: 'HAY', tiploc: 'HAYESAH', name: 'Hayes & Harlington' },
  { crs: 'HXX', tiploc: 'HTRWAPT', name: 'Heathrow Central' },
  { crs: 'HAF', tiploc: 'HTRWTM4', name: 'Heathrow Terminal 4' },
  { crs: 'HWV', tiploc: 'HTRWTM5', name: 'Heathrow Terminal 5' },
  { crs: 'WDT', tiploc: 'WDRYTON', name: 'West Drayton' },
  { crs: 'IVR', tiploc: 'IVER', name: 'Iver' },
  { crs: 'LNY', tiploc: 'LANGLEY', name: 'Langley' },
  { crs: 'SLO', tiploc: 'SLOUGH', name: 'Slough' },
  { crs: 'BNM', tiploc: 'BNHAM', name: 'Burnham' },
  { crs: 'TAP', tiploc: 'TAPLOW', name: 'Taplow' },
  { crs: 'MAI', tiploc: 'MDNHEAD', name: 'Maidenhead' },
  { crs: 'TWY', tiploc: 'TWYFORD', name: 'Twyford' },
  { crs: 'RDG', tiploc: 'RDNGSTN', name: 'Reading' },
].sort((a, b) => a.name.localeCompare(b.name));

const ELIZABETH_LINE_DESTINATIONS = [
  // Operational Depots, Sidings & Turnbacks
  { tiploc: 'MDNHDRS', name: 'Maidenhead Turnback' },
  { tiploc: 'OLDOENG', name: 'Old Oak Engine Sdg' },
  { tiploc: 'ROYAOSD', name: 'Royal Oak Sidings' },
  { tiploc: 'OLDOXRS', name: 'Old Oak Depot' },
  { tiploc: 'MDNHDCS', name: 'Maidenhead CS' },
  { tiploc: 'GIDEPKS', name: 'Gidea Park CS' },
  { tiploc: 'GIDECES', name: 'Gidea Pk C/E Spur' },
  { tiploc: 'SHENFMS', name: 'Shenfield CS' },
  { tiploc: 'ILFEMUD', name: 'Ilford E.M.U.D.' },
  { tiploc: 'WBRNPKS', name: 'Westbourne Park Sidings' },
  { tiploc: 'WEALEMU', name: 'West Ealing EMUD' },
  { tiploc: 'ABWDXRS', name: 'Abbey Wood Sidings' },
  { tiploc: 'PLMSXCR', name: 'Plumstead CS' },
  // Primary Stations
  { crs: 'ABW', tiploc: 'ABWDXR', name: 'Abbey Wood' },
  { crs: 'GDP', tiploc: 'GIDEAPK', name: 'Gidea Park' },
  { crs: 'SNF', tiploc: 'SHENFLD', name: 'Shenfield' },
  { crs: 'LST', tiploc: 'LIVSTLL', name: 'Liverpool Street' },
  { crs: 'PAD', tiploc: 'PADTLL', name: 'Paddington LL' },
  { crs: 'HAY', tiploc: 'HAYESAH', name: 'Hayes & Harlington' },
  { crs: 'HAF', tiploc: 'HTRWTM4', name: 'Heathrow Terminal 4' },
  { crs: 'HWV', tiploc: 'HTRWTM5', name: 'Heathrow Terminal 5' },
  { crs: 'MAI', tiploc: 'MDNHEAD', name: 'Maidenhead' },
  { crs: 'RDG', tiploc: 'RDNGSTN', name: 'Reading' },
].sort((a, b) => a.name.localeCompare(b.name));

const PRESET_ROUTES = [
  { label: 'Pad - T4', origin: 'PAD', destination: 'HAF' },
  { label: 'Pad - T5', origin: 'PAD', destination: 'HWV' },
  { label: 'Pad - Maidenhead', origin: 'PAD', destination: 'MAI' },
  { label: 'Pad - Reading', origin: 'PAD', destination: 'RDG' },
  { label: 'Pad - Shenfield', origin: 'PAD', destination: 'SNF' },
  { label: 'Pad - OOC', origin: 'PAD', destination: 'OLDOXRS' },
  { label: 'OOC - Pad', origin: 'OLDOXRS', destination: 'PAD' },
] as const;

export default function FindJobs({ user, onLogout, onNavigate, darkMode, toggleDarkMode }: FindJobsProps) {
  const isDemoUser = Boolean(user.isDemo || user.email?.toLowerCase().startsWith('demo-'));
  const isAdminOrMod = !isDemoUser && (user.role === 'admin' || user.role === 'moderator');

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

  const [feedStatus, setFeedStatus] = useState<RemoteApiStatus | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  useEffect(() => {
    const now = getLondonDate();
    const todayStr = formatDateKey(now);
    setDate(todayStr);
    setHour(String(now.getHours()).padStart(2, '0'));
    setMinute(String(now.getMinutes()).padStart(2, '0'));

    if (isDemoUser) {
      setHasSearched(true);
      setServices([
        {
          std: '07:30',
          arrAtDest: '08:25',
          date: todayStr,
          etd: 'On time',
          platform: 'A',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination: 'Shenfield',
          headcode: '9W36',
          isPassengerService: true,
        },
        {
          std: '07:35',
          arrAtDest: '08:06',
          date: todayStr,
          etd: 'On time',
          platform: 'B',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination: 'Abbey Wood',
          headcode: '9U38',
          isPassengerService: true,
        },
        {
          std: '07:42',
          arrAtDest: '08:30',
          date: todayStr,
          etd: 'Exp. 07:45',
          platform: 'A',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination: 'Gidea Park',
          headcode: '9W40',
          isPassengerService: true,
        },
        {
          std: '07:48',
          arrAtDest: '08:20',
          date: todayStr,
          etd: 'On time',
          platform: 'B',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination: 'Heathrow Terminal 4',
          headcode: '9H42',
          isPassengerService: true,
        },
        {
          std: '07:55',
          arrAtDest: '08:52',
          date: todayStr,
          etd: 'On time',
          platform: 'A',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination: 'Reading',
          headcode: '9R44',
          isPassengerService: true,
        },
        {
          std: '08:02',
          arrAtDest: '08:57',
          date: todayStr,
          etd: 'On time',
          platform: 'B',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination: 'Shenfield',
          headcode: '9W46',
          isPassengerService: true,
        },
      ]);
    } else if (isAdminOrMod) {
      fetchFeedStatus();
    }
  }, [isDemoUser, isAdminOrMod]);

  const fetchFeedStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/nr/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFeedStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch Live Train API status', err);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/nr/cache/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status) setFeedStatus(data.status);
      if (res.ok) {
        setCacheMessage('Schedule cache cleared.');
      } else {
        setCacheMessage('Failed to clear cache.');
      }
    } catch {
      setCacheMessage('Failed to clear cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const performSearch = async (originCode: string, destCode: string) => {
    if (isDemoUser) return;
    const cleanOrigin = originCode.trim().toUpperCase();
    if (!cleanOrigin) {
      setError('Origin station or location is required.');
      return;
    }
    const cleanDest = destCode.trim().toUpperCase();

    setLoading(true);
    setError('');
    setHasSearched(true);
    setServices([]);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('origin', cleanOrigin);
      if (cleanDest) params.append('destination', cleanDest);
      if (date) params.append('date', date);
      if (date && hour && minute) {
        params.append('time', `${date}T${hour}:${minute}:00`);
      }
      params.append('limit', '10');

      const res = await fetch(`/api/nr/departures?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (data?.debug && isAdminOrMod) {
        setDebugInfo(data.debug);
        if (data.debug.feedStatus) {
          setFeedStatus(data.debug.feedStatus);
        }
      }

      if (!res.ok || !data) {
        if (isAdminOrMod) fetchFeedStatus();
        setError('Unable to load live train services right now. Please contact an admin.');
        return;
      }

      setServices(data.services || []);
    } catch (err) {
      console.error('Error querying Remote Live Train API:', err);
      setError('Unable to load live train services right now. Please contact an admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch(crs, filterCrs);
  };

  const handleQuickRoute = async (originCode: string, destCode: string) => {
    if (isDemoUser || loading) return;
    setCrs(originCode);
    setFilterCrs(destCode);
    await performSearch(originCode, destCode);
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

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Find Jobs (Live Departures)</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Search live Elizabeth Line schedules, VSTP short-term plans, and TRUST movements from the live feed database to find headcodes.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
          {isDemoUser && (
            <div className="mb-5 p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <span className="font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 uppercase tracking-wide text-[10px]">
                  Demo Mode • View Only
                </span>
                <span>Live departure search is disabled in demo mode. Displaying sample Elizabeth Line services below.</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 w-full md:w-auto min-w-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">Origin</label>
              <select
                value={crs}
                onChange={(e) => setCrs(e.target.value)}
                disabled={isDemoUser}
                className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-[13px] appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                required
              >
                <option value="" disabled>Select station...</option>
                {ELIZABETH_LINE_LOCATIONS.map((station) => (
                  <option key={station.tiploc} value={station.crs || station.tiploc}>
                    {station.name} ({station.crs ? `${station.crs} / ${station.tiploc}` : station.tiploc})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 w-full md:w-auto min-w-0">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">Destination</label>
              <select
                value={filterCrs}
                onChange={(e) => setFilterCrs(e.target.value)}
                disabled={isDemoUser}
                className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-[13px] appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">All Destinations</option>
                {ELIZABETH_LINE_DESTINATIONS.map((station) => (
                  <option key={station.tiploc} value={station.crs || station.tiploc}>
                    {station.name} ({station.crs ? `${station.crs} / ${station.tiploc}` : station.tiploc})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isDemoUser}
                  className="w-full sm:w-[125px] px-1.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  disabled={isDemoUser}
                  className="w-12 px-1 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-sm appearance-none text-center disabled:opacity-60 disabled:cursor-not-allowed"
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
                  disabled={isDemoUser}
                  className="w-12 px-1 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors text-xs sm:text-sm appearance-none text-center disabled:opacity-60 disabled:cursor-not-allowed"
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
              disabled={isDemoUser || loading || !crs.trim()}
              title={isDemoUser ? 'Departure searching is disabled in Demo Mode (View Only)' : undefined}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 h-[42px] w-full md:w-auto shrink-0 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isDemoUser ? 'View Only' : 'Search'}</span>
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center gap-2">
            {PRESET_ROUTES.map((route) => {
              const isActive = crs === route.origin && filterCrs === route.destination;
              return (
                <button
                  key={`${route.origin}-${route.destination}`}
                  type="button"
                  disabled={isDemoUser || loading}
                  onClick={() => handleQuickRoute(route.origin, route.destination)}
                  title={isDemoUser ? 'Quick routes are disabled in Demo Mode (View Only)' : `Search ${route.label}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <Train className="w-3.5 h-3.5 shrink-0 opacity-75" />
                  <span>{route.label}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400 text-sm transition-colors">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load departures</p>
                <p className="mt-1">{error}</p>
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
                <p>No scheduled or VSTP Elizabeth Line services match this route, date, and time window.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Departs</th>
                      <th className="px-4 py-3 font-medium">Destination</th>
                      <th className="px-4 py-3 font-medium text-center">Platform</th>
                      <th className="px-4 py-3 font-medium">Headcode</th>
                      <th className="px-4 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {services.map((service, index) => (
                      <tr key={`${service.trainUid || service.headcode}-${service.std}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          <div>{service.std}</div>
                          {service.arrAtDest && (
                            <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              Arr. {service.arrAtDest}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-slate-700 dark:text-slate-300 truncate max-w-[220px]"
                          title={
                            service.destinationTiploc && service.destinationTiploc !== service.destination
                              ? `${service.destination} (${service.destinationTiploc})`
                              : service.destination
                          }
                        >
                          {service.destination}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-center">{service.platform}</td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={`https://tdtools.co.uk/roster/headcode.php?action=headcode-list&date=${service.date}&headcode=${service.headcode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:text-blue-600 hover:border-blue-400 font-mono text-xs font-semibold px-2 py-1 rounded transition-colors"
                            >
                              {service.headcode}
                            </a>
                            {service.isPassengerService === false && (
                              <span
                                className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                                title="Non-passenger / Empty Coaching Stock movement"
                              >
                                ECS
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${
                              service.etd === 'On time'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : service.etd === 'Cancelled'
                                  ? 'text-red-600 dark:text-red-400'
                                  : service.etd === 'Scheduled'
                                    ? 'text-slate-500 dark:text-slate-400'
                                    : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {service.etd}
                          </span>
                          {service.lastLocation && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              @ {service.lastLocation}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {isAdminOrMod && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors mt-8">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-full px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-500" />
                Admin Panel (Remote Live Train API Status)
              </h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {showDebug ? 'Hide' : 'Show'}
              </span>
            </button>
            {showDebug && (
              <div className="p-6 space-y-5">
                {feedStatus && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Globe className="w-4 h-4 text-indigo-500" />
                        <span>Remote FastAPI Connection</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${
                            feedStatus.configured
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
                          }`}
                        >
                          {feedStatus.configured ? 'Configured' : 'Not Configured'}
                        </span>
                        <button
                          type="button"
                          onClick={fetchFeedStatus}
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-slate-500 dark:text-slate-400">Cached Schedule Dates</div>
                        <div className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                          {feedStatus.cachedDates.length}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-slate-500 dark:text-slate-400">Catalog Headcodes</div>
                        <div className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                          {feedStatus.candidateHeadcodesCount.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-slate-500 dark:text-slate-400">Last Query Latency</div>
                        <div className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                          {feedStatus.lastQueryDurationMs !== null ? `${feedStatus.lastQueryDurationMs}ms` : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2 font-mono truncate">
                        <Database className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {feedStatus.apiUrlPreview || 'URL not configured'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearCache}
                        disabled={clearingCache}
                        className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{clearingCache ? 'Clearing...' : 'Clear Schedule Cache'}</span>
                      </button>
                    </div>

                    {cacheMessage && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2.5 rounded border border-slate-200 dark:border-slate-700">
                        {cacheMessage}
                      </div>
                    )}

                    {feedStatus.lastError && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap">
                        API Error: {feedStatus.lastError}
                      </div>
                    )}
                  </div>
                )}

                {debugInfo?.error && (
                  <div>
                    <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Error Details</h3>
                    <pre className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg overflow-auto max-h-[200px] text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap border border-red-200 dark:border-red-900/50">
                      {debugInfo.error}
                    </pre>
                  </div>
                )}

                {debugInfo && !debugInfo.error && (
                  <div className="relative group">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Query Diagnostics</h3>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-[300px] text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap border border-slate-200 dark:border-slate-800">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} user={user} />
      )}
    </div>
  );
}
