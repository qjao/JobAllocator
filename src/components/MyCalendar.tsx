import React, { useEffect, useState } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Home, Loader2, CheckCircle2, Moon, Sun, LogOut, X, Pencil, Trash2, AlertTriangle, Shield, User as UserIcon, HelpCircle, Plus } from 'lucide-react';
import { Allocation, User, Conflict } from '../types';
import { cn, getFinancialWeek } from '../lib/utils';
import HelpModal from './HelpModal';

import { io } from 'socket.io-client';

interface MyCalendarProps {
  user: User;
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar') => void;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

import Header from './Header';

export default function MyCalendar({ user, onNavigate, onLogout, darkMode, toggleDarkMode }: MyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Edit state
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [editJobNumber, setEditJobNumber] = useState('');
  const [editIsFullJob, setEditIsFullJob] = useState(true);
  const [editHeadcodesInput, setEditHeadcodesInput] = useState('');
  const [editNotesInput, setEditNotesInput] = useState('');
  const [editInstructorId, setEditInstructorId] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  
  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Claim state
  const [claimModalDate, setClaimModalDate] = useState<Date | null>(null);
  const [claimJobNumber, setClaimJobNumber] = useState('');
  const [claimIsFullJob, setClaimIsFullJob] = useState(true);
  const [claimHeadcodesInput, setClaimHeadcodesInput] = useState('');
  const [claimNotesInput, setClaimNotesInput] = useState('');
  const [showClaimNotes, setShowClaimNotes] = useState(false);
  const [claimFormError, setClaimFormError] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  
  const startDateStr = format(weekStart, 'yyyy-MM-dd');
  const endDateStr = format(weekEnd, 'yyyy-MM-dd');

  useEffect(() => {
    const fetchAllocations = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/allocations?startDate=${startDateStr}&endDate=${endDateStr}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAllocations(data);
        }
      } catch (error) {
        console.error("Error fetching allocations:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchUsers = async () => {
      if (user.role !== 'admin' && user.role !== 'moderator') return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchAllocations();
    fetchUsers();

    const socket = io();

    socket.on('allocation_added', (alloc: Allocation) => {
      if (alloc.date >= startDateStr && alloc.date <= endDateStr) {
        setAllocations(prev => {
          if (prev.find(a => a.id === alloc.id)) return prev;
          return [alloc, ...prev].sort((a, b) => b.createdAt - a.createdAt);
        });
      }
    });

    socket.on('allocation_updated', (alloc: Allocation) => {
      if (alloc.date >= startDateStr && alloc.date <= endDateStr) {
        setAllocations(prev => prev.map(a => a.id === alloc.id ? alloc : a));
      }
    });

    socket.on('allocation_deleted', ({ id }) => {
      setAllocations(prev => prev.filter(a => a.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [startDateStr, endDateStr]);

  const daysInWeek = eachDayOfInterval({
    start: weekStart,
    end: weekEnd
  });

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const getAllocationsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    let dayAllocations = allocations.filter(a => a.date === dateStr);
    if (showOnlyMine) {
      dayAllocations = dayAllocations.filter(a => a.instructorId === user.id);
    }
    
    return dayAllocations.sort((a, b) => {
      const aIsMine = a.instructorId === user.id;
      const bIsMine = b.instructorId === user.id;
      
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      
      return a.jobNumber.localeCompare(b.jobNumber);
    });
  };

  const validateJobNumber = (job: string, dateStr: string): string | null => {
    if (!/^[A-Za-z]{2}\d{4}$/.test(job)) {
      return 'Job number must be in format LLXXXX (e.g., AW1101).';
    }

    const upperJob = job.toUpperCase();
    const depotCode = upperJob.substring(0, 2);
    const dayCode = upperJob.charAt(2);
    const depotNum = upperJob.charAt(3);

    const validDepots: Record<string, string> = {
      'AW': '1',
      'GP': '2',
      'IF': '3',
      'MH': '4',
      'OC': '5',
      'PU': '6',
      'SH': '7'
    };

    if (!validDepots[depotCode]) {
      return `Invalid depot code. Must be one of: ${Object.keys(validDepots).join(', ')}.`;
    }

    const exceptionSuffixes: Record<string, string[]> = {
      'GP': ['001'],
      'IF': ['002']
    };
    
    const isException = exceptionSuffixes[depotCode]?.includes(upperJob.substring(3));

    if (!isException && validDepots[depotCode] !== depotNum) {
      return `Invalid depot number for ${depotCode}. Expected ${validDepots[depotCode]}, got ${depotNum}.`;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    let expectedDayCodes: string[] = [];
    let dayType = '';
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      expectedDayCodes = ['1', '4'];
      dayType = 'weekday';
    } else if (dayOfWeek === 6) {
      expectedDayCodes = ['2', '5'];
      dayType = 'Saturday';
    } else if (dayOfWeek === 0) {
      expectedDayCodes = ['3', '6'];
      dayType = 'Sunday';
    }

    if (!expectedDayCodes.includes(dayCode)) {
      return `Invalid day code for a ${dayType}. Expected ${expectedDayCodes.join(' or ')}, got ${dayCode}.`;
    }

    return null; // Valid
  };
  const validateHeadcode = (hc: string) => /^\d[A-Za-z]\d{2}$/.test(hc);

  const checkConflicts = (job: string, fullJob: boolean, headcodes: string[], dateStr: string, excludeId?: string): Conflict[] => {
    const conflicts: Conflict[] = [];
    const upperJob = job.toUpperCase();
    
    allocations.filter(a => a.date === dateStr).forEach(alloc => {
      if (excludeId && alloc.id === excludeId) return;

      if (alloc.jobNumber.toUpperCase() === upperJob) {
        if (alloc.isFullJob) {
          conflicts.push({
            type: 'full_job',
            message: `${alloc.instructorName} has already claimed the full job ${upperJob}.`,
            conflictingAllocation: alloc
          });
        } else if (fullJob) {
          conflicts.push({
            type: 'full_job',
            message: `${alloc.instructorName} has already claimed parts of job ${upperJob}. You cannot claim the full job.`,
            conflictingAllocation: alloc
          });
        } else {
          const overlapping = headcodes.filter(hc => alloc.headcodes.includes(hc.toUpperCase()));
          if (overlapping.length > 0) {
            conflicts.push({
              type: 'headcode',
              message: `${alloc.instructorName} has already claimed headcode(s) ${overlapping.join(', ')} for job ${upperJob}.`,
              conflictingAllocation: alloc
            });
          }
        }
      }
    });

    return conflicts;
  };

  const openEditModal = (alloc: Allocation) => {
    setEditingAllocation(alloc);
    setEditJobNumber(alloc.jobNumber);
    setEditIsFullJob(alloc.isFullJob);
    setEditHeadcodesInput(alloc.headcodes ? alloc.headcodes.join(', ') : '');
    setEditNotesInput(alloc.notes || '');
    setEditInstructorId(alloc.instructorId);
    setShowEditNotes(!!alloc.notes);
    setEditFormError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAllocation) return;
    setEditFormError('');

    const job = editJobNumber.trim().toUpperCase();
    const jobError = validateJobNumber(job, editingAllocation.date);
    if (jobError) {
      setEditFormError(jobError);
      return;
    }

    let parsedHeadcodes: string[] = [];
    if (!editIsFullJob) {
      parsedHeadcodes = editHeadcodesInput.split(',').map(h => h.trim().toUpperCase()).filter(h => h);
      if (parsedHeadcodes.length === 0) {
        setEditFormError('Please enter at least one headcode for a partial job.');
        return;
      }
      for (const hc of parsedHeadcodes) {
        if (!validateHeadcode(hc)) {
          setEditFormError(`Invalid headcode format: ${hc}. Must be XLXX (e.g., 1A23).`);
          return;
        }
      }
    }

    const conflicts = checkConflicts(job, editIsFullJob, parsedHeadcodes, editingAllocation.date, editingAllocation.id);
    if (conflicts.length > 0) {
      setEditFormError(conflicts[0].message);
      return;
    }

    setEditSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/allocations/${editingAllocation.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jobNumber: job,
          isFullJob: editIsFullJob,
          headcodes: editIsFullJob ? [] : parsedHeadcodes,
          notes: editNotesInput.trim(),
          instructorId: (user.role === 'admin' || user.role === 'moderator') ? editInstructorId : undefined
        })
      });

      if (!res.ok) throw new Error('Failed to update allocation');

      setEditingAllocation(null);
      setSelectedAllocation(null);
    } catch (error) {
      console.error("Error updating allocation:", error);
      setEditFormError('Failed to update allocation. Check permissions.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/allocations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to delete allocation');
      setDeleteConfirmId(null);
      setSelectedAllocation(null);
    } catch (error) {
      console.error("Error deleting allocation:", error);
      setDeleteConfirmId(null);
    }
  };

  const openClaimModal = (date: Date) => {
    setClaimModalDate(date);
    setClaimJobNumber('');
    setClaimIsFullJob(true);
    setClaimHeadcodesInput('');
    setClaimNotesInput('');
    setShowClaimNotes(false);
    setClaimFormError('');
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimModalDate) return;
    setClaimFormError('');

    const job = claimJobNumber.trim().toUpperCase();
    const dateStr = format(claimModalDate, 'yyyy-MM-dd');
    const jobError = validateJobNumber(job, dateStr);
    if (jobError) {
      setClaimFormError(jobError);
      return;
    }

    let parsedHeadcodes: string[] = [];
    if (!claimIsFullJob) {
      parsedHeadcodes = claimHeadcodesInput.split(',').map(h => h.trim().toUpperCase()).filter(h => h);
      if (parsedHeadcodes.length === 0) {
        setClaimFormError('Please enter at least one headcode for a partial job.');
        return;
      }
      for (const hc of parsedHeadcodes) {
        if (!validateHeadcode(hc)) {
          setClaimFormError(`Invalid headcode format: ${hc}. Must be XLXX (e.g., 1A23).`);
          return;
        }
      }
    }

    const conflicts = checkConflicts(job, claimIsFullJob, parsedHeadcodes, dateStr);
    if (conflicts.length > 0) {
      setClaimFormError(conflicts[0].message);
      return;
    }

    setClaimSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jobNumber: job,
          date: dateStr,
          isFullJob: claimIsFullJob,
          headcodes: claimIsFullJob ? [] : parsedHeadcodes,
          notes: claimNotesInput.trim()
        })
      });

      if (!res.ok) throw new Error('Failed to create allocation');

      setClaimModalDate(null);
    } catch (error) {
      console.error("Error creating allocation:", error);
      setClaimFormError('Failed to claim job. Please try again.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Header
        user={user}
        currentView="calendar"
        onNavigate={onNavigate as any}
        onLogout={onLogout}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onHelp={() => setShowHelpModal(true)}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
          {/* Calendar Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 dark:bg-slate-800/50 gap-4 transition-colors">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold tracking-wide transition-colors">
                Week {getFinancialWeek(weekStart).week}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={showOnlyMine}
                  onChange={(e) => setShowOnlyMine(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500 transition-colors"
                />
                Show only mine
              </label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={today}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Today
                </button>
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden transition-colors">
                  <button 
                    onClick={prevWeek}
                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400 border-r border-slate-300 dark:border-slate-600"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={nextWeek}
                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-400"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700 transition-colors">
              {daysInWeek.map((day, i) => {
                const dayAllocations = getAllocationsForDay(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div key={day.toISOString()} className={cn(
                    "min-h-[200px] p-3 transition-colors",
                    isToday ? "bg-blue-50/30 dark:bg-blue-900/10" : "bg-white dark:bg-slate-800"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">
                        {format(day, 'EEE')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openClaimModal(day)}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-full transition-colors"
                          title="Claim Job"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-colors",
                          isToday ? "bg-blue-600 text-white" : "text-slate-900 dark:text-slate-100"
                        )}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {dayAllocations.length === 0 ? (
                        <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-4 transition-colors">
                          No jobs
                        </div>
                      ) : (
                        dayAllocations.map(alloc => (
                          <div 
                            key={alloc.id}
                            onClick={() => setSelectedAllocation(alloc)}
                            className={cn(
                              "p-2 rounded-md border text-sm flex flex-col gap-1 transition-colors cursor-pointer hover:shadow-md",
                              alloc.instructorId === user.id 
                                ? "border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40" 
                                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/70"
                            )}
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                              <a 
                                href={`https://tdtools.co.uk/roster/diagram.php?action=date&date=${alloc.date}&name=${alloc.jobNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "font-bold hover:underline font-mono tracking-tight shrink-0 transition-colors",
                                  alloc.instructorId === user.id ? "text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                                )}
                              >
                                {alloc.jobNumber}
                              </a>
                              
                              {!showOnlyMine && alloc.instructorId !== user.id && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate ml-auto shrink-0 transition-colors">
                                  {alloc.instructorName}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-1 overflow-hidden min-w-0">
                              {alloc.isFullJob ? (
                                <span className="flex w-fit items-center gap-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded shrink-0 transition-colors">
                                  <CheckCircle2 className="w-3 h-3" /> Full Job
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1 items-center min-w-0">
                                  {alloc.headcodes.map(hc => (
                                    <a
                                      key={hc}
                                      href={`https://tdtools.co.uk/roster/headcode.php?action=headcode-list&date=${alloc.date}&headcode=${hc}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded truncate transition-colors hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:underline"
                                    >
                                      {hc}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            {alloc.notes && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate transition-colors" title={alloc.notes}>
                                {alloc.notes}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {selectedAllocation && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setSelectedAllocation(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl transition-colors" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Allocation Details</h3>
              <button 
                onClick={() => setSelectedAllocation(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <a 
                    href={`https://tdtools.co.uk/roster/diagram.php?action=date&date=${selectedAllocation.date}&name=${selectedAllocation.jobNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-mono tracking-tight"
                  >
                    {selectedAllocation.jobNumber}
                  </a>
                  {selectedAllocation.isFullJob ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded transition-colors">
                      <CheckCircle2 className="w-3 h-3" /> Full Job
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded transition-colors">
                      Partial Job
                    </span>
                  )}
                </div>
                
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Claimed by <span className="font-medium text-slate-900 dark:text-slate-100">{selectedAllocation.instructorName}</span>
                  {selectedAllocation.instructorId === user.id && <span className="text-blue-600 dark:text-blue-400 ml-1">(You)</span>}
                </div>
              </div>

              {!selectedAllocation.isFullJob && selectedAllocation.headcodes.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider block mb-2">Headcodes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAllocation.headcodes.map(hc => (
                      <a 
                        key={hc} 
                        href={`https://tdtools.co.uk/roster/headcode.php?action=headcode-list&date=${selectedAllocation.date}&headcode=${hc}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 font-mono text-xs px-2 py-1 rounded-md transition-colors block"
                      >
                        {hc}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedAllocation.notes && (
                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600 transition-colors">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider block mb-1">Notes</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedAllocation.notes}</p>
                </div>
              )}

              <div className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                {selectedAllocation.createdAt && <span>Allocated at {new Date(selectedAllocation.createdAt).toLocaleString()}</span>}
                {selectedAllocation.updatedAt && <span>Edited at {new Date(selectedAllocation.updatedAt).toLocaleString()}</span>}
              </div>

              {(selectedAllocation.instructorId === user.id || user.role === 'admin' || user.role === 'moderator') && (
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => openEditModal(selectedAllocation)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(selectedAllocation.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-xl transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Allocation</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">Are you sure you want to delete this allocation? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAllocation && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              Edit Allocation
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {(user.role === 'admin' || user.role === 'moderator') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allocated User</label>
                  <select
                    value={editInstructorId}
                    onChange={(e) => setEditInstructorId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
                    required
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Job Number</label>
                <input
                  type="text"
                  value={editJobNumber}
                  onChange={(e) => setEditJobNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 uppercase transition-colors"
                  maxLength={6}
                  required
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors">
                <input
                  type="checkbox"
                  id="editFullJob"
                  checked={editIsFullJob}
                  onChange={(e) => setEditIsFullJob(e.target.checked)}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 rounded border-slate-300 dark:border-slate-500 focus:ring-blue-500 bg-white dark:bg-slate-800"
                />
                <label htmlFor="editFullJob" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Claim Full Job
                </label>
              </div>

              {!editIsFullJob && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Headcodes</label>
                  <input
                    type="text"
                    value={editHeadcodesInput}
                    onChange={(e) => setEditHeadcodesInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 uppercase transition-colors"
                    required={!editIsFullJob}
                  />
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowEditNotes(!showEditNotes)}
                  className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-1"
                >
                  Instructor Notes (Optional)
                  <span className="text-blue-500 dark:text-blue-400 font-bold text-lg leading-none">{showEditNotes ? '-' : '+'}</span>
                </button>
                {showEditNotes && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                      value={editNotesInput}
                      onChange={(e) => setEditNotesInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 min-h-[80px] resize-y transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {editFormError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm transition-colors">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{editFormError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingAllocation(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {claimModalDate && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              Claim Job for {format(claimModalDate, 'MMM d, yyyy')}
            </h3>
            
            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Job Number</label>
                <input
                  type="text"
                  value={claimJobNumber}
                  onChange={(e) => setClaimJobNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 uppercase transition-colors"
                  maxLength={6}
                  required
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors">
                <input
                  type="checkbox"
                  id="claimFullJob"
                  checked={claimIsFullJob}
                  onChange={(e) => setClaimIsFullJob(e.target.checked)}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 rounded border-slate-300 dark:border-slate-500 focus:ring-blue-500 bg-white dark:bg-slate-800"
                />
                <label htmlFor="claimFullJob" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Claim Full Job
                </label>
              </div>

              {!claimIsFullJob && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Headcodes</label>
                  <input
                    type="text"
                    value={claimHeadcodesInput}
                    onChange={(e) => setClaimHeadcodesInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 uppercase transition-colors"
                    required={!claimIsFullJob}
                  />
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowClaimNotes(!showClaimNotes)}
                  className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-1"
                >
                  Instructor Notes (Optional)
                  <span className="text-blue-500 dark:text-blue-400 font-bold text-lg leading-none">{showClaimNotes ? '-' : '+'}</span>
                </button>
                {showClaimNotes && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                      value={claimNotesInput}
                      onChange={(e) => setClaimNotesInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 min-h-[80px] resize-y transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {claimFormError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm transition-colors">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{claimFormError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setClaimModalDate(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={claimSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  {claimSubmitting ? 'Claiming...' : 'Claim Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}
