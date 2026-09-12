import React, { useEffect, useState } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LogOut, AlertTriangle, Plus, Trash2, CheckCircle2, Train, Pencil, Shield, User as UserIcon, HelpCircle, X, Moon, Sun, Search } from 'lucide-react';
import { Allocation, Conflict, User } from '../types';
import { cn, getFinancialWeek } from '../lib/utils';
import { io } from 'socket.io-client';

import HelpModal from './HelpModal';
import DiagramSelector from './DiagramSelector';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar') => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

import Header from './Header';

export default function Dashboard({ user, onLogout, onNavigate, darkMode, toggleDarkMode }: DashboardProps) {
  // Default to 2026-09-12 for demonstration purposes since the CSV data provided is primarily for this Saturday
  const [selectedDate, setSelectedDate] = useState<Date>(new Date('2026-09-12T12:00:00Z'));
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const myAllocationsCount = allocations.filter(a => a.instructorId === user.id).length;
  
  const displayedAllocations = [...allocations]
    .filter(a => showOnlyMine ? a.instructorId === user.id : true)
    .sort((a, b) => {
      const aIsMine = a.instructorId === user.id;
      const bIsMine = b.instructorId === user.id;
      
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      
      return a.jobNumber.localeCompare(b.jobNumber);
    });

  useEffect(() => {
    const fetchAllocations = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/allocations?date=${dateStr}`, {
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

    const socket = io({ auth: { token: localStorage.getItem('token') } });

    socket.on('allocation_added', (alloc: Allocation) => {
      if (alloc.date === dateStr) {
        setAllocations(prev => {
          if (prev.find(a => a.id === alloc.id)) return prev;
          return [alloc, ...prev].sort((a, b) => b.createdAt - a.createdAt);
        });
      }
    });

    socket.on('allocation_updated', (alloc: Allocation) => {
      if (alloc.date === dateStr) {
        setAllocations(prev => prev.map(a => a.id === alloc.id ? alloc : a));
      }
    });

    socket.on('allocation_deleted', ({ id }) => {
      setAllocations(prev => prev.filter(a => a.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [dateStr]);

  const validateJobNumber = (job: string, date: Date): string | null => {
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

  const checkConflicts = (job: string, fullJob: boolean, headcodes: string[], excludeId?: string): Conflict[] => {
    const conflicts: Conflict[] = [];
    const upperJob = job.toUpperCase();
    
    allocations.forEach(alloc => {
      if (excludeId && alloc.id === excludeId) return;

      // Conflict only happens on the same job number
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
          // Both are partial jobs, check for overlapping headcodes
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

  const handleAddAllocation = async (job: string, fullJob: boolean, headcodes: string[], notes: string) => {
    setFormError('');

    const jobError = validateJobNumber(job, selectedDate);
    if (jobError) {
      setFormError(jobError);
      return;
    }

    const conflicts = checkConflicts(job, fullJob, headcodes);
    if (conflicts.length > 0) {
      setFormError(conflicts[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: dateStr,
          jobNumber: job,
          isFullJob: fullJob,
          headcodes: fullJob ? [] : headcodes,
          notes: notes.trim()
        })
      });

      if (!res.ok) throw new Error('Failed to add allocation');
    } catch (error) {
      console.error("Error adding allocation:", error);
      setFormError('Failed to add allocation. Check permissions.');
    } finally {
      setSubmitting(false);
    }
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
    const jobError = validateJobNumber(job, selectedDate);
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

    const conflicts = checkConflicts(job, editIsFullJob, parsedHeadcodes, editingAllocation.id);
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
    } catch (error) {
      console.error("Error deleting allocation:", error);
      setFormError("Failed to delete allocation.");
      setDeleteConfirmId(null);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    return format(new Date(ts), 'MMM d, yyyy HH:mm');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Header
        user={user}
        currentView="dashboard"
        onNavigate={onNavigate as any}
        onLogout={onLogout}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onHelp={() => setShowHelpModal(true)}
      >
        <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1 shrink-0">
          <button 
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors text-slate-600 dark:text-slate-300"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="flex flex-col items-center justify-center min-w-[110px] sm:min-w-[140px]">
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
              <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-400" />
              {format(selectedDate, 'MMM d, yyyy')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Week {getFinancialWeek(selectedDate).week}
            </div>
          </div>
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors text-slate-600 dark:text-slate-300"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </Header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-1">
            <DiagramSelector 
              darkMode={darkMode}
              selectedDate={selectedDate}
              allocations={allocations}
              onAddAllocation={handleAddAllocation}
              formError={formError}
              submitting={submitting}
            />
          </div>

          {/* Right Column: List */}
          <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Allocations for {format(selectedDate, 'MMM d')}</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showOnlyMine}
                  onChange={(e) => setShowOnlyMine(e.target.checked)}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 rounded border-slate-300 dark:border-slate-500 focus:ring-blue-500 bg-white dark:bg-slate-800"
                />
                Show only mine
              </label>
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-full transition-colors">
                {allocations.length} {allocations.length === 1 ? 'Job' : 'Jobs'} 
                {myAllocationsCount > 0 && ` (${myAllocationsCount} Mine)`}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading allocations...</div>
          ) : displayedAllocations.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-dashed rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 transition-colors">
              <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                {allocations.length > 0 ? 'No jobs match your filter' : 'No jobs allocated yet'}
              </p>
              <p>{allocations.length > 0 ? 'Try unchecking "Show only mine".' : 'Be the first to claim a job for this day.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedAllocations.map((alloc) => {
                const isMine = user.id === alloc.instructorId;
                
                return (
                  <div 
                    key={alloc.id} 
                    className={cn(
                      "bg-white dark:bg-slate-800 border rounded-xl p-4 shadow-sm transition-all relative overflow-hidden",
                      isMine ? "border-blue-200 dark:border-blue-800/50 ring-1 ring-blue-50 dark:ring-blue-900/20" : "border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {isMine && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 dark:bg-blue-400" />
                    )}
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <a 
                            href={`https://tdtools.co.uk/roster/diagram.php?action=date&date=${alloc.date}&name=${alloc.jobNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-mono tracking-tight"
                          >
                            {alloc.jobNumber}
                          </a>
                          {alloc.isFullJob ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded transition-colors">
                              <CheckCircle2 className="w-3 h-3" /> Full Job
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded transition-colors">
                              Partial Job
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                          Claimed by <span className="font-medium text-slate-900 dark:text-slate-100">{alloc.instructorName}</span>
                          {isMine && <span className="text-blue-600 dark:text-blue-400 ml-1">(You)</span>}
                        </div>

                        {!alloc.isFullJob && alloc.headcodes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {alloc.headcodes.map((hc, idx) => (
                              <a 
                                key={`${hc}-${idx}`} 
                                href={`https://tdtools.co.uk/roster/headcode.php?action=headcode-list&date=${alloc.date}&headcode=${hc}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 font-mono text-xs px-2 py-1 rounded-md transition-colors block"
                              >
                                {hc}
                              </a>
                            ))}
                          </div>
                        )}

                        {alloc.notes && (
                          <div className="mt-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-600 transition-colors">
                            <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider block mb-1">Notes</span>
                            {alloc.notes}
                          </div>
                        )}

                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-3 flex items-center gap-2">
                          {alloc.createdAt && <span>Allocated at {formatTime(alloc.createdAt)}</span>}
                          {alloc.updatedAt && <span>• Edited at {formatTime(alloc.updatedAt)}</span>}
                        </div>
                      </div>

                      {(isMine || user.role === 'admin' || user.role === 'moderator') && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(alloc)}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit allocation"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(alloc.id)}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete allocation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </main>

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
      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}
