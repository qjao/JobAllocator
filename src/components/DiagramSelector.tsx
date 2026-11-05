import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Plus, AlertTriangle, X, Pencil, Maximize2, User as UserIcon, MapPin, Server, ExternalLink, RefreshCw } from 'lucide-react';
import { Allocation } from '../types';
import TDToolsConfigModal from './TDToolsConfigModal';
import DriverEmailLink from './DriverEmailLink';

interface DriverInfo {
  found: boolean;
  driverName?: string;
  depot?: string;
  allocType?: 'Daily' | 'Weekly' | string;
  isDemo?: boolean;
  source?: 'tdtools_api' | 'local_db' | 'local_csv';
  pdfname?: string;
  page?: string | number;
  imageUrl?: string;
  pdfUrl?: string;
  isStp?: boolean;
  cancelled?: boolean;
}

interface JobData {
  jobid: string;
  name: string;
  priority: number;
  daycode: string;
  isStp: boolean;
  from?: string;
  to?: string;
  cancel?: boolean;
  pdfname?: string;
  page?: string;
}

interface DiagramSelectorProps {
  darkMode: boolean;
  selectedDate: Date;
  allocations: Allocation[];
  onAddAllocation: (jobNumber: string, isFullJob: boolean, headcodes: string[], notes: string) => Promise<void>;
  formError?: string;
  submitting?: boolean;
  onCancel?: () => void;
  title?: string;
  isDemo?: boolean;
  canAccessTDTools?: boolean;
  canRefreshDiagrams?: boolean;
  currentUserName?: string;
  initialAllocation?: {
    jobNumber: string;
    isFullJob: boolean;
    headcodes: string[];
    notes?: string;
  };
  children?: React.ReactNode;
}

const DEPOT_NAMES: Record<string, string> = {
  'AW': 'Abbey Wood',
  'GP': 'Gidea Park',
  'IF': 'Ilford',
  'MH': 'Maidenhead',
  'OC': 'Old Oak Common',
  'PU': 'Plumstead',
  'SH': 'Shenfield'
};

export default function DiagramSelector({ darkMode, selectedDate, allocations, onAddAllocation, formError, submitting, onCancel, title, isDemo, canAccessTDTools = false, canRefreshDiagrams = false, currentUserName = '', initialAllocation, children }: DiagramSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  
  // Data state
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [headcodesMap, setHeadcodesMap] = useState<Record<string, string[]>>({});
  
  // Selection state
  const [selectedDepot, setSelectedDepot] = useState<string>(initialAllocation ? initialAllocation.jobNumber.substring(0, 2) : '');
  const [selectedDiagram, setSelectedDiagram] = useState<string>(initialAllocation?.jobNumber || '');
  const [selectedHeadcodeIndices, setSelectedHeadcodeIndices] = useState<number[]>([]);
  const [isFullDiagram, setIsFullDiagram] = useState<boolean>(initialAllocation?.isFullJob ?? true);
  const [showNotes, setShowNotes] = useState<boolean>(!!initialAllocation?.notes);
  const [notesInput, setNotesInput] = useState<string>(initialAllocation?.notes || '');
  const [initialized, setInitialized] = useState<boolean>(!initialAllocation);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<{ source?: string; totalJobs?: number; counts?: any; dbErrors?: any } | null>(null);

  // Derived data
  const [depots, setDepots] = useState<string[]>([]);
  const [availableDiagrams, setAvailableDiagrams] = useState<JobData[]>([]);
  const [availableHeadcodes, setAvailableHeadcodes] = useState<string[]>([]);

  // Driver & Depot Info state
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loadingDriverInfo, setLoadingDriverInfo] = useState(false);
  const [showTDToolsModal, setShowTDToolsModal] = useState(false);

  // Clear selections on date change
  const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const prevDateKeyRef = useRef(dateKey);

  useEffect(() => {
    if (prevDateKeyRef.current !== dateKey) {
      prevDateKeyRef.current = dateKey;
      setSelectedDepot('');
      setSelectedDiagram('');
      setSelectedHeadcodeIndices([]);
      setIsFullDiagram(true);
      setShowNotes(false);
      setNotesInput('');
      setDriverInfo(null);
    }
  }, [dateKey]);

  // Fetch driver & depot allocation when a diagram or date changes
  useEffect(() => {
    if (!selectedDiagram) {
      setDriverInfo(null);
      return;
    }

    let isMounted = true;
    const fetchDriverInfo = async () => {
      setLoadingDriverInfo(true);
      try {
        const token = localStorage.getItem('token');
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const res = await fetch(`/api/diagrams/driver-info?date=${encodeURIComponent(dateStr)}&job=${encodeURIComponent(selectedDiagram)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDriverInfo(data.found ? data : null);
          }
        } else {
          if (isMounted) setDriverInfo(null);
        }
      } catch (e) {
        console.warn('Failed to fetch driver info:', e);
        if (isMounted) setDriverInfo(null);
      } finally {
        if (isMounted) setLoadingDriverInfo(false);
      }
    };

    fetchDriverInfo();
    return () => {
      isMounted = false;
    };
  }, [selectedDiagram, selectedDate]);

  const loadData = React.useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setApiError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/diagrams?_t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!res.ok) throw new Error('Failed to load diagram data');
      
      const data = await res.json();
      const unifiedJobs: JobData[] = Array.isArray(data.jobs) ? data.jobs : [];
      const hm: Record<string, string[]> = data.headcodesMap || {};

      setJobs(unifiedJobs);
      setHeadcodesMap(hm);
      setSourceInfo({
        source: data.source,
        totalJobs: unifiedJobs.length,
        counts: data.counts,
        dbErrors: data.dbErrors
      });

      // Extract unique depots (strictly 2 uppercase letters e.g. AW, GP, IF, MH, OC, PU, SH)
      const depotSet = new Set<string>();
      unifiedJobs.forEach(job => {
        if (job.name) {
          const cleanName = job.name.trim().replace(/\s+/g, '');
          if (cleanName.length >= 2) {
            const prefix = cleanName.substring(0, 2).toUpperCase();
            if (/^[A-Z]{2}$/.test(prefix)) {
              depotSet.add(prefix);
            }
          }
        }
      });
      setDepots(Array.from(depotSet).sort());
    } catch (err) {
      console.error("Failed to load Diagram API data", err);
      setApiError('Unable to load jobs data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedDepot) {
      const dayOfWeek = selectedDate.getDay();
      let expectedDayCodes: string[] = [];
      let dayLetters: string[] = [];

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        expectedDayCodes = ['1', '4'];
        dayLetters = ['M', 'T', 'W', 'V', 'F', 'SX'];
      } else if (dayOfWeek === 6) {
        expectedDayCodes = ['2', '5'];
        dayLetters = ['S', 'SO'];
      } else if (dayOfWeek === 0) {
        expectedDayCodes = ['3', '6'];
        dayLetters = ['X', 'SUN'];
      }
      
      const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

      const exceptionSuffixes: Record<string, string[]> = {
        'GP': ['001'],
        'IF': ['002']
      };

      // 1. Primary Filter: matches depot and date schedule
      const filtered = jobs.filter(j => {
        const cleanName = (j.name || '').trim().replace(/\s+/g, '').toUpperCase();
        if (!cleanName.startsWith(selectedDepot.toUpperCase())) return false;
        
        // Date range validity check (handles YYYY-MM-DD or DD/MM/YYYY)
        if (j.from && j.to) {
          const parseDateString = (str: string) => {
            const s = str.trim();
            if (s.includes('/')) {
              const parts = s.split('/');
              if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            return s;
          };
          const fromDate = parseDateString(j.from);
          const toDate = parseDateString(j.to);
          if (selectedDateStr < fromDate || selectedDateStr > toDate) {
            return false;
          }
        }
        
        const depotCode = cleanName.substring(0, 2);
        const dayCode = cleanName.substring(2, 3);
        const suffix = cleanName.substring(3);
        
        if (exceptionSuffixes[depotCode]?.includes(suffix)) {
          return true;
        }

        // Check if 3rd character is numeric daycode
        if (expectedDayCodes.includes(dayCode)) {
          return true;
        }

        // Fallback: check j.daycode if provided from database
        if (j.daycode) {
          const dc = String(j.daycode).toUpperCase();
          if (dayLetters.some(letter => dc.includes(letter))) {
            return true;
          }
        }
        
        return false;
      });

      // 2. If filtered by strict schedule is empty, fall back to all diagrams for this depot
      const candidateJobs = filtered.length > 0 ? filtered : jobs.filter(j => {
        const cleanName = (j.name || '').trim().replace(/\s+/g, '').toUpperCase();
        return cleanName.startsWith(selectedDepot.toUpperCase());
      });

      const dedupedMap = new Map<string, JobData>();
      candidateJobs.forEach(j => {
        if (!dedupedMap.has(j.name) || j.isStp) {
          dedupedMap.set(j.name, j);
        }
      });
      
      setAvailableDiagrams(Array.from(dedupedMap.values()));
    } else {
      setAvailableDiagrams([]);
    }
  }, [selectedDepot, jobs, selectedDate]);

  useEffect(() => {
    if (selectedDiagram && selectedDepot && !selectedDiagram.startsWith(selectedDepot)) {
      setSelectedDiagram('');
      setAvailableHeadcodes([]);
      setSelectedHeadcodeIndices([]);
    }
  }, [selectedDepot, selectedDiagram]);

  // Handle diagram selection change without clearing headcodes if same diagram
  const claimedHeadcodes = React.useMemo(() => {
    if (!selectedDiagram) return new Set<string>();
    const matching = allocations.filter(a => a.jobNumber === selectedDiagram);
    const claimed = new Set<string>();
    matching.forEach(a => {
      if (!a.isFullJob && Array.isArray(a.headcodes)) {
        a.headcodes.forEach(hc => claimed.add(hc));
      }
    });
    return claimed;
  }, [selectedDiagram, allocations]);

  const isPartiallyBooked = claimedHeadcodes.size > 0;

  useEffect(() => {
    if (isPartiallyBooked && isFullDiagram) {
      setIsFullDiagram(false);
    }
  }, [isPartiallyBooked, isFullDiagram]);

  useEffect(() => {
    if (selectedDiagram) {
      const job = availableDiagrams.find(j => j.name === selectedDiagram);
      if (job) {
        const key = job.isStp ? `stp_${job.jobid}` : `ltp_${job.jobid}`;
        const hcs = headcodesMap[key] || [];
        setAvailableHeadcodes(hcs);
        
        if (!initialized && initialAllocation) {
          if (initialAllocation.isFullJob) {
            setSelectedHeadcodeIndices(hcs.map((_, i) => i));
            setIsFullDiagram(true);
          } else {
            const indices = initialAllocation.headcodes
              .map(hc => hcs.indexOf(hc))
              .filter(i => i !== -1);
            setSelectedHeadcodeIndices(indices);
            if (indices.length === hcs.length && hcs.length > 0) {
              setIsFullDiagram(true);
            } else {
              setIsFullDiagram(false);
            }
          }
          setInitialized(true);
        } else if (isFullDiagram) {
          setSelectedHeadcodeIndices(hcs.map((_, i) => i));
        }
      }
    } else {
      setAvailableHeadcodes([]);
      setSelectedHeadcodeIndices([]);
    }
  }, [selectedDiagram, jobs, headcodesMap, availableDiagrams, initialized, initialAllocation]);

  const handleHeadcodeToggle = (idx: number) => {
    if (isFullDiagram) {
      setIsFullDiagram(false);
      setSelectedHeadcodeIndices([idx]);
    } else {
      let newSelection = [...selectedHeadcodeIndices];
      if (newSelection.includes(idx)) {
        newSelection = newSelection.filter(i => i !== idx);
      } else {
        newSelection.push(idx);
      }
      setSelectedHeadcodeIndices(newSelection);
      if (newSelection.length === availableHeadcodes.length && availableHeadcodes.length > 0) {
        setIsFullDiagram(true);
      }
    }
  };

  const handleFullDiagramToggle = () => {
    const nextState = !isFullDiagram;
    setIsFullDiagram(nextState);
    if (nextState) {
      setSelectedHeadcodeIndices(availableHeadcodes.map((_, i) => i));
    } else {
      setSelectedHeadcodeIndices([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagram) return;
    
    // Automatically treat it as a full diagram if all headcodes are selected
    const allSelected = selectedHeadcodeIndices.length === availableHeadcodes.length && availableHeadcodes.length > 0;
    const submitAsFull = isFullDiagram || allSelected;
    
    const headcodesToSubmit = submitAsFull 
      ? [] 
      : selectedHeadcodeIndices.map(idx => availableHeadcodes[idx]);

    await onAddAllocation(
      selectedDiagram,
      submitAsFull,
      headcodesToSubmit,
      notesInput
    );
    
    // Reset form after successful submit
    setSelectedDiagram('');
    setSelectedDepot('');
    setIsFullDiagram(true);
    setNotesInput('');
    if (onCancel) onCancel();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Prefer the deduplicated version (which correctly prioritizes STP over LTP)
  const currentJob = availableDiagrams.find(j => j.name === selectedDiagram);
  const activePdfName = driverInfo?.pdfname || currentJob?.pdfname;
  const activePage = driverInfo?.page || currentJob?.page;
  const activeImageUrl = driverInfo?.imageUrl || (activePdfName && activePage ? `https://tdtools.co.uk/roster/diagramimg.php?pdfname=${encodeURIComponent(String(activePdfName))}&page=${encodeURIComponent(String(activePage))}` : null);
  const isStp = driverInfo?.isStp ?? currentJob?.isStp ?? false;
  const isCancelled = driverInfo?.cancelled ?? currentJob?.cancel ?? false;

  const isDemoActive = Boolean(isDemo || driverInfo?.isDemo);
  const obfuscateName = (name?: string) => {
    if (!name) return '';
    return name
      .trim()
      .split(/\s+/)
      .map(part => {
        if (part.length <= 1) return part;
        return part[0] + '*'.repeat(Math.max(3, part.length - 1));
      })
      .join(' ');
  };
  const displayDriverName = isDemoActive ? obfuscateName(driverInfo?.driverName) : driverInfo?.driverName;
  const selectedDateString = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  if (apiError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <p>{apiError}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative ${onCancel ? 'max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain' : ''}`}>
      {onCancel && (
        <div className="sticky top-0 z-30 -mx-6 -mt-6 mb-4 flex h-12 items-center justify-end bg-white/95 px-3 backdrop-blur dark:bg-slate-800/95">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close edit form"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 pr-8 flex items-center gap-2">
        <Plus className="w-6 h-6 text-blue-500 dark:text-blue-400" />
        {title || 'Claim Job'}
      </h2>
      
      {jobs.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <Server className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold">No Diagrams Loaded from TDtools</div>
              <p className="text-amber-700 dark:text-amber-300">
                The dashboard dropdowns populate live from your TDtools API (<code className="font-mono">r_jobs</code>, <code className="font-mono">r_jobs_stp</code>, and <code className="font-mono">r_jobs_headcodes</code>). Connect and synchronize your endpoint to load all depots and diagrams.
              </p>
            </div>
          </div>
          {canAccessTDTools && <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowTDToolsModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Connect & Sync TDtools
            </button>
          </div>}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Select Depot
              </label>
              <div className="flex items-center gap-2">
                {canRefreshDiagrams && (
                  <button
                    type="button"
                    title="Refresh diagrams from TDtools"
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                )}
                {canAccessTDTools && (
                  <button
                    type="button"
                    onClick={() => setShowTDToolsModal(true)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    API Settings
                  </button>
                )}
              </div>
            </div>
            <select
              value={selectedDepot}
              onChange={(e) => setSelectedDepot(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">-- Select Depot --</option>
              {depots.map(depot => (
                <option key={depot} value={depot}>{DEPOT_NAMES[depot] || depot} ({depot})</option>
              ))}
            </select>
          </div>

          {selectedDepot && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select Diagram
              </label>
              <select
                value={selectedDiagram}
                onChange={(e) => {
                  const newDiagram = e.target.value;
                  if (newDiagram !== selectedDiagram) {
                    setNotesInput('');
                    setShowNotes(false);
                  }
                  setSelectedDiagram(newDiagram);
                  
                  const matching = allocations.filter(a => a.jobNumber === newDiagram);
                  const claimed = new Set();
                  matching.forEach(a => {
                    if (!a.isFullJob && Array.isArray(a.headcodes)) {
                      a.headcodes.forEach(hc => claimed.add(hc));
                    }
                  });
                  const isPartiallyBookedNew = claimed.size > 0;
                  
                  setIsFullDiagram(!isPartiallyBookedNew);
                  setSelectedHeadcodeIndices([]);
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              >
                <option value="">-- Select Diagram --</option>
                {availableDiagrams.map(diagram => {
                  const matchingAllocations = allocations.filter(a => a.jobNumber === diagram.name);
                  const isFullyBooked = matchingAllocations.some(a => a.isFullJob);
                  const isPartiallyBooked = !isFullyBooked && matchingAllocations.length > 0;
                  const isDisabled = diagram.cancel || isFullyBooked;
                  
                  // Remove the first 2 characters (depot initials)
                  const displayName = diagram.name.length > 2 ? diagram.name.substring(2) : diagram.name;
                  
                  let statusText = diagram.cancel ? '(CANCELLED)' : diagram.isStp ? '(STP)' : '(LTP)';
                  if (isFullyBooked) statusText += ' - Fully Booked';
                  else if (isPartiallyBooked) statusText += ' - Partially Booked';

                  return (
                    <option key={diagram.jobid} value={diagram.name} disabled={isDisabled}>
                      {displayName} {statusText}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Driver & Depot Contact Information & Live Diagram Status */}
        {selectedDiagram && (
          <div className="mt-4">
            {loadingDriverInfo ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Checking roster driver & diagram allocation...</span>
              </div>
            ) : driverInfo?.found && driverInfo.driverName ? (
              <div className="relative p-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 shadow-xs animate-in fade-in duration-200 overflow-hidden">
                {/* Allocation Type Tag in Top Right Corner (Weekly or Daily) */}
                {driverInfo.allocType && (
                  <span
                    className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shadow-2xs border ${
                      driverInfo.allocType.toLowerCase().includes('week')
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {driverInfo.allocType}
                  </span>
                )}

                <div className="flex items-start gap-3 pr-16">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Roster Driver
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5" title={displayDriverName}>
                      {displayDriverName}
                    </div>
                    {driverInfo.depot && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate">
                          Depot: <strong className="font-semibold text-slate-900 dark:text-slate-100">{driverInfo.depot}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 italic">
                No roster driver listed for this diagram on {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
              </div>
            )}
          </div>
        )}

        {/* Diagram Image / PDF View (retrieved dynamically from API or local roster) */}
        {(activeImageUrl || (activePdfName && activePage)) && (
          <div className="w-full flex justify-center">
            {isCancelled ? (
              <div className="mt-6 mb-2 w-full lg:w-[300px] p-8 border border-red-200 dark:border-red-800/50 rounded-lg bg-red-50 dark:bg-red-950/20 text-center text-red-600 dark:text-red-400 font-bold uppercase tracking-wider text-sm shadow-xs">
                Diagram Cancelled
              </div>
            ) : (
              <div 
                id="diagram-preview-box"
                className="mt-6 mb-2 w-full lg:w-[300px] h-auto lg:h-[425px] border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white block relative group cursor-zoom-in shadow-sm"
                onClick={() => setIsPreviewOpen(true)}
              >
                <img 
                  src={activeImageUrl || `https://tdtools.co.uk/roster/diagramimg.php?pdfname=${encodeURIComponent(String(activePdfName))}&page=${encodeURIComponent(String(activePage))}`} 
                  alt={`Diagram Preview for ${selectedDiagram}`} 
                  className={
                    isStp 
                      ? "w-[145%] max-w-[145%] -ml-[8%] -mb-[40%] lg:mb-0 h-auto shrink-0" 
                      : "w-[133%] max-w-[133%] -ml-[2%] -mb-[54%] lg:mb-0 h-auto shrink-0"
                  }
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Try backend proxy if direct loading fails
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('/api/diagrams/image-proxy') && activePdfName && activePage) {
                      target.src = `/api/diagrams/image-proxy?pdfname=${encodeURIComponent(String(activePdfName))}&page=${encodeURIComponent(String(activePage))}`;
                    } else {
                      target.style.display = 'none';
                    }
                  }}
                />
                <div
                  className="absolute top-2 right-2 p-2 bg-slate-900/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-sm pointer-events-none"
                >
                  <Maximize2 className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>
        )}

        {selectedDiagram && availableHeadcodes.length > 0 && (
          <div className="mb-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Headcodes
            </label>
            
            <div className="flex flex-col gap-4">
              <label className={`flex items-start space-x-3 p-2 rounded-lg transition-colors -ml-2 ${isPartiallyBooked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                <input
                  type="checkbox"
                  checked={isFullDiagram}
                  disabled={isPartiallyBooked}
                  onChange={handleFullDiagramToggle}
                  className="w-5 h-5 mt-0.5 shrink-0 rounded border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800 disabled:opacity-50"
                />
                <span className="text-slate-900 dark:text-white font-medium flex flex-col">
                  <span>Claim Full Diagram</span>
                  {isPartiallyBooked && <span className="text-sm text-slate-500 dark:text-slate-400 font-normal leading-tight mt-0.5">(Unavailable - Partially Booked)</span>}
                </span>
              </label>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                {availableHeadcodes.map((hc, idx) => {
                  const isClaimed = claimedHeadcodes.has(hc);
                  return (
                    <label key={`${hc}-${idx}`} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${isClaimed ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed' : 'cursor-pointer bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'}`}>
                      <input
                        type="checkbox"
                        checked={(!isFullDiagram && selectedHeadcodeIndices.includes(idx)) || isClaimed}
                        disabled={isClaimed}
                        onChange={() => !isClaimed && handleHeadcodeToggle(idx)}
                        className="w-4 h-4 shrink-0 rounded border-slate-300 dark:border-slate-500 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800 disabled:opacity-50"
                      />
                      <span className={`text-sm font-mono tracking-wide truncate ${isClaimed ? 'text-slate-500 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                        {hc}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {selectedDiagram && availableHeadcodes.length === 0 && (
          <div className="mb-6 border-t border-slate-200 dark:border-slate-700 pt-6 text-slate-500 dark:text-slate-400">
            No headcodes available for this diagram. You can still claim it as a full job.
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700 pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2"
            >
              Instructor Notes (Optional)
              <span className="text-blue-500 dark:text-blue-400 font-bold text-lg leading-none">{showNotes ? '-' : '+'}</span>
            </button>
            
            {showNotes && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Add any relevant notes..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors resize-y"
                />
              </div>
            )}
          </div>

          {children && (
            <div className="mt-4">
              {children}
            </div>
          )}
          
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm mb-4 transition-colors">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{formError}</p>
            </div>
          )}

          {!initialAllocation && driverInfo?.driverName && (
            <div className="mb-3">
              <DriverEmailLink
                driverName={driverInfo.driverName}
                jobNumber={selectedDiagram}
                date={selectedDateString}
                isFullJob={isFullDiagram || (selectedHeadcodeIndices.length === availableHeadcodes.length && availableHeadcodes.length > 0)}
                headcodes={isFullDiagram ? [] : selectedHeadcodeIndices.map(index => availableHeadcodes[index])}
                notes={notesInput}
                currentUserName={currentUserName}
                isDemo={isDemoActive}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!selectedDiagram || submitting || (!isFullDiagram && selectedHeadcodeIndices.length === 0)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors shadow-sm"
            >
              {submitting ? 'Saving...' : (initialAllocation ? 'Save Changes' : 'Add Allocation')}
            </button>
          </div>
        </div>
      </form>
      
      <AnimatePresence>
        {isPreviewOpen && (activeImageUrl || (activePdfName && activePage)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm cursor-zoom-out"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-full max-h-full rounded-xl overflow-hidden bg-white shadow-2xl flex flex-col items-center justify-center cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={activeImageUrl || `https://tdtools.co.uk/roster/diagramimg.php?pdfname=${encodeURIComponent(String(activePdfName))}&page=${encodeURIComponent(String(activePage))}`} 
                alt={`Full Preview for ${selectedDiagram}`} 
                className="w-auto h-auto max-w-[95vw] max-h-[90vh] object-contain cursor-zoom-out" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('/api/diagrams/image-proxy') && activePdfName && activePage) {
                    target.src = `/api/diagrams/image-proxy?pdfname=${encodeURIComponent(String(activePdfName))}&page=${encodeURIComponent(String(activePage))}`;
                  }
                }}
                onClick={() => setIsPreviewOpen(false)}
              />
              {driverInfo?.found && (
                <div className="absolute top-4 left-4 z-10 px-3.5 py-2 rounded-lg bg-slate-900/85 backdrop-blur-md text-white text-xs shadow-lg flex flex-col sm:flex-row sm:items-center gap-2 pointer-events-none">
                  {driverInfo.driverName && (
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="font-semibold">{displayDriverName}</span>
                      {driverInfo.depot && (
                        <span className="text-slate-300 ml-1 opacity-90">({driverInfo.depot})</span>
                      )}
                      {driverInfo.allocType && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/30 text-blue-300 border border-blue-400/30">
                          {driverInfo.allocType}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-900/50 hover:bg-slate-900/80 text-white rounded-full transition-colors backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TDToolsConfigModal
        isOpen={showTDToolsModal && canAccessTDTools}
        onClose={() => setShowTDToolsModal(false)}
        isAdmin={true}
        onSyncSuccess={() => {
          loadData(true);
        }}
      />
    </div>
  );
}
