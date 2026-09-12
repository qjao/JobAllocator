import React, { useState, useEffect } from 'react';
import { Loader2, Plus, AlertTriangle, X, Pencil } from 'lucide-react';
import { Allocation } from '../types';

interface JobData {
  jobid: string;
  name: string;
  priority: number;
  daycode: string;
  isStp: boolean;
  from?: string;
  to?: string;
  cancel?: boolean;
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

export default function DiagramSelector({ darkMode, selectedDate, allocations, onAddAllocation, formError, submitting, onCancel, title, initialAllocation, children }: DiagramSelectorProps) {
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

  // Derived data
  const [depots, setDepots] = useState<string[]>([]);
  const [availableDiagrams, setAvailableDiagrams] = useState<JobData[]>([]);
  const [availableHeadcodes, setAvailableHeadcodes] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/diagrams', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) throw new Error('Failed to load diagram data');
        
        const data = await res.json();
        const unifiedJobs: JobData[] = data.jobs;
        const hm: Record<string, string[]> = data.headcodesMap;

        setJobs(unifiedJobs);
        setHeadcodesMap(hm);

        // Extract unique depots (first 2 characters of name)
        const depotSet = new Set<string>();
        unifiedJobs.forEach(job => {
          if (job.name && job.name.length >= 2) {
            depotSet.add(job.name.substring(0, 2));
          }
        });
        setDepots(Array.from(depotSet).sort());
      } catch (err) {
        console.error("Failed to load Diagram API data", err);
        setApiError('Unable to load jobs data.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDepot) {
      const dayOfWeek = selectedDate.getDay();
      let expectedDayCodes: string[] = [];
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        expectedDayCodes = ['1', '4'];
      } else if (dayOfWeek === 6) {
        expectedDayCodes = ['2', '5'];
      } else if (dayOfWeek === 0) {
        expectedDayCodes = ['3', '6'];
      }
      
      const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

      const exceptionSuffixes: Record<string, string[]> = {
        'GP': ['001'],
        'IF': ['002']
      };

      const filtered = jobs.filter(j => {
        if (!j.name.startsWith(selectedDepot)) return false;
        
        if (j.from && j.to) {
          const fromDate = j.from.trim();
          const toDate = j.to.trim();
          if (selectedDateStr < fromDate || selectedDateStr > toDate) {
            return false;
          }
        }
        
        const depotCode = j.name.substring(0, 2);
        const dayCode = j.name.substring(2, 3);
        const suffix = j.name.substring(3);
        
        if (exceptionSuffixes[depotCode]?.includes(suffix)) {
          return true;
        }
        
        return expectedDayCodes.includes(dayCode);
      });

      const dedupedMap = new Map<string, JobData>();
      filtered.forEach(j => {
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

  if (apiError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <p>{apiError}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative">
      {onCancel && (
        <button 
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 pr-8 flex items-center gap-2">
        <Plus className="w-6 h-6 text-blue-500 dark:text-blue-400" />
        {title || 'Claim Job'}
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Depot
            </label>
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

        {selectedDiagram && availableHeadcodes.length > 0 && (
          <div className="mb-6 border-t border-slate-200 dark:border-slate-700 pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
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
    </div>
  );
}
