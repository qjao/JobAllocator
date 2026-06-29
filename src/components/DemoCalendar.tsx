import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Home, CheckCircle2, Moon, Sun, LogOut, Shield, User as UserIcon, HelpCircle, Plus, X, AlertTriangle, Trash2 } from 'lucide-react';
import { cn, getFinancialWeek } from '../lib/utils';
import { Allocation, Conflict } from '../types';
import HelpModal from './HelpModal';

interface DemoCalendarProps {
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar') => void;
  onExit: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  allocations: Allocation[];
  setAllocations: React.Dispatch<React.SetStateAction<Allocation[]>>;
}

export default function DemoCalendar({ onNavigate, onExit, darkMode, toggleDarkMode, allocations, setAllocations }: DemoCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const user = { id: '999', name: 'Demo User', role: 'user' };

  // Claim Form State
  const [claimModalDate, setClaimModalDate] = useState<Date | null>(null);
  const [claimJobNumber, setClaimJobNumber] = useState('');
  const [claimIsFullJob, setClaimIsFullJob] = useState(true);
  const [claimHeadcodesInput, setClaimHeadcodesInput] = useState('');
  const [claimNotesInput, setClaimNotesInput] = useState('');
  const [showClaimNotes, setShowClaimNotes] = useState(false);
  const [formError, setFormError] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

    if (validDepots[depotCode] !== depotNum) {
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

  const checkConflicts = (job: string, fullJob: boolean, headcodes: string[], checkDateStr: string, excludeId?: string): Conflict[] => {
    const conflicts: Conflict[] = [];
    const upperJob = job.toUpperCase();
    
    allocations.filter(a => a.date === checkDateStr).forEach(alloc => {
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

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimModalDate) return;

    setFormError('');

    const job = claimJobNumber.trim().toUpperCase();
    const dateStr = format(claimModalDate, 'yyyy-MM-dd');
    const jobError = validateJobNumber(job, claimModalDate);
    
    if (jobError) {
      setFormError(jobError);
      return;
    }

    let parsedHeadcodes: string[] = [];
    if (!claimIsFullJob) {
      parsedHeadcodes = claimHeadcodesInput.split(',').map(h => h.trim().toUpperCase()).filter(h => h);
      if (parsedHeadcodes.length === 0) {
        setFormError('Please enter at least one headcode for a partial job.');
        return;
      }
      for (const hc of parsedHeadcodes) {
        if (!validateHeadcode(hc)) {
          setFormError(`Invalid headcode format: ${hc}. Must be XLXX (e.g., 1A23).`);
          return;
        }
      }
    }

    const conflicts = checkConflicts(job, claimIsFullJob, parsedHeadcodes, dateStr);
    if (conflicts.length > 0) {
      setFormError(conflicts[0].message);
      return;
    }

    const newAlloc: Allocation = {
      id: `demo-${Date.now()}`,
      date: dateStr,
      jobNumber: job,
      isFullJob: claimIsFullJob,
      headcodes: parsedHeadcodes,
      notes: claimNotesInput.trim(),
      instructorId: user.id,
      instructorName: user.name,
      createdAt: Date.now(),
    };

    setAllocations(prev => [newAlloc, ...prev]);
    closeClaimModal();
  };

  const closeClaimModal = () => {
    setClaimModalDate(null);
    setClaimJobNumber('');
    setClaimHeadcodesInput('');
    setClaimNotesInput('');
    setClaimIsFullJob(true);
    setShowClaimNotes(false);
    setFormError('');
  };

  const confirmDelete = (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
    setDeleteConfirmId(null);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="bg-blue-600 dark:bg-blue-800 text-white text-center py-2 text-sm font-medium">
        Demo Mode - Calendar view is interactive, but data will be reset upon exit.
      </div>
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-lg">
            <CalendarIcon className="w-6 h-6" />
            <span className="hidden sm:inline">Calendar</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <nav className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => onNavigate('dashboard')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <Home className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => onNavigate('admin')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span>
              </button>
              <button 
                disabled
                className="text-sm font-medium text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed flex items-center gap-1"
                title="Disabled in demo"
              >
                <UserIcon className="w-4 h-4" /> <span className="hidden sm:inline">Profile</span>
              </button>
              <button 
                onClick={toggleDarkMode}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="hidden sm:inline">Theme</span>
              </button>
              <button 
                onClick={() => setShowHelpModal(true)}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Help</span>
              </button>
              <button 
                onClick={onExit}
                className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Exit Demo</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

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
                        onClick={() => {
                          setClaimModalDate(day);
                          setClaimJobNumber('');
                          setClaimHeadcodesInput('');
                          setClaimNotesInput('');
                          setClaimIsFullJob(true);
                          setShowClaimNotes(false);
                          setFormError('');
                        }}
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
                          className={cn(
                            "p-2 rounded-md border text-sm flex flex-col gap-1 transition-colors relative group",
                            alloc.instructorId === user.id 
                              ? "border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20" 
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                          )}
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                            <a 
                                href={`https://tdtools.co.uk/roster/diagram.php?action=date&date=${alloc.date}&name=${alloc.jobNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                "font-bold font-mono tracking-tight shrink-0 hover:underline transition-colors",
                                alloc.instructorId === user.id 
                                  ? "text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" 
                                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                              )}>
                              {alloc.jobNumber}
                            </a>
                            
                            {alloc.isFullJob ? (
                              <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded shrink-0 transition-colors border border-emerald-200/50 dark:border-emerald-800/50">
                                <CheckCircle2 className="w-3 h-3" /> Full
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 px-1.5 py-0.5 rounded truncate min-w-0 transition-colors" title={alloc.headcodes.join(', ')}>
                                {alloc.headcodes.join(', ')}
                              </span>
                            )}

                            {!showOnlyMine && alloc.instructorId !== user.id && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate ml-auto shrink-0 transition-colors inline-block max-w-[60px]" title={alloc.instructorName}>
                                {alloc.instructorName.split(' ')[0]}
                              </span>
                            )}
                          </div>
                           {alloc.instructorId === user.id && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setDeleteConfirmId(alloc.id);
                               }}
                               className="absolute -top-1.5 -right-1.5 p-1 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full opacity-0 group-hover:opacity-100 shadow-sm transition-all hover:bg-red-200 dark:hover:bg-red-900/60 hover:scale-110 z-10"
                               title="Delete"
                             >
                               <Trash2 className="w-3 h-3" />
                             </button>
                           )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Claim Job form over/modal structure */}
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
                  placeholder="e.g., AW1101"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 uppercase transition-colors"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Format: 2 letters, 4 numbers (LLXXXX)</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors">
                <input
                  type="checkbox"
                  id="claimFullJob"
                  checked={claimIsFullJob}
                  onChange={(e) => setClaimIsFullJob(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-500 focus:ring-blue-500 rounded"
                />
                <label htmlFor="claimFullJob" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Claim Full Job
                </label>
              </div>

              {!claimIsFullJob && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Headcodes (comma-separated)</label>
                  <input
                    type="text"
                    value={claimHeadcodesInput}
                    onChange={(e) => setClaimHeadcodesInput(e.target.value.toUpperCase())}
                    placeholder="e.g., 1A23, 2B45"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 uppercase transition-colors"
                    required
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Enter the train headcodes you are covering
                  </p>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowClaimNotes(!showClaimNotes)}
                  className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2 cursor-pointer"
                >
                  Instructor Notes (Optional)
                  <span className="text-blue-500 dark:text-blue-400 font-bold text-lg leading-none">{showClaimNotes ? '-' : '+'}</span>
                </button>
                {showClaimNotes && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                      value={claimNotesInput}
                      onChange={(e) => setClaimNotesInput(e.target.value)}
                      placeholder="Add any relevant notes..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 min-h-[80px] resize-y transition-colors"
                    />
                  </div>
                )}
              </div>

               {formError && (
                 <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm transition-colors">
                   <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                   <p>{formError}</p>
                 </div>
               )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeClaimModal}
                  className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Claim Job
                </button>
              </div>
            </form>
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

      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}
