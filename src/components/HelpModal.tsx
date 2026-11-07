import React, { useState } from 'react';
import { 
  HelpCircle, 
  X, 
  Calendar, 
  Mail, 
  Train, 
  AlertTriangle, 
  Layers, 
  CheckCircle2, 
  Info, 
  Eye, 
  ChevronDown 
} from 'lucide-react';
import { User } from '../types';

interface HelpModalProps {
  onClose: () => void;
  user?: User;
}

type TabKey = 'claiming' | 'driver' | 'conflicts' | 'views' | 'find-jobs' | 'faq';

interface HelpSection {
  id: TabKey;
  label: string;
  icon: React.ElementType;
  description: string;
}

const SECTIONS: HelpSection[] = [
  { 
    id: 'claiming', 
    label: 'Claiming Diagrams', 
    icon: Layers, 
    description: 'How to claim full or partial shifts, STP/LTP selection, and add notes' 
  },
  { 
    id: 'driver', 
    label: 'Driver & Cutout Contact', 
    icon: Mail, 
    description: 'Roster driver info, Daily vs Weekly badges, and DI cutout emails' 
  },
  { 
    id: 'conflicts', 
    label: 'Conflict Detection', 
    icon: AlertTriangle, 
    description: 'Double-booking prevention, partial headcode overlaps, and warnings' 
  },
  { 
    id: 'views', 
    label: 'Dashboard & Calendar', 
    icon: Calendar, 
    description: 'Filtering your jobs, editing allocations, and weekly schedule navigation' 
  },
  { 
    id: 'find-jobs', 
    label: 'Live Train Tracker (NRE)', 
    icon: Train, 
    description: 'National Rail Darwin live departures, TIPLOC search, and headcode lookups' 
  },
  { 
    id: 'faq', 
    label: 'FAQs & Troubleshooting', 
    icon: Info, 
    description: 'TDtools synchronization, diagram PDF zoom preview, and demo privacy' 
  },
];

export default function HelpModal({ onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('claiming');

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl h-[88vh] max-h-[760px] flex flex-col overflow-hidden transition-colors">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/75 dark:bg-slate-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Instructor Allocator Guide
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  User Handbook
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Walkthrough of diagram allocation, driver contact, live services, and troubleshooting
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close help modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Topics Dropdown Selector */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <label htmlFor="help-topic-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>Select Topic:</span>
          </label>
          <div className="relative w-full sm:w-80">
            <select
              id="help-topic-select"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabKey)}
              className="w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2 pr-9 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors shadow-2xs cursor-pointer"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Main Article Body (Full Width) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-700 dark:text-slate-200 text-sm">
          
          {/* 1. CLAIMING DIAGRAMS */}
          {activeTab === 'claiming' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Claiming Shifts & Diagrams
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How diagrams, depots, headcodes, and shift types are scheduled and booked.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs flex items-center justify-center font-bold">1</span>
                    Depot & Date Matching
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Select a depot (Abbey Wood, Old Oak Common, Maidenhead, Gidea Park, Ilford, Plumstead, Shenfield). The allocator automatically filters available diagrams against the calendar day.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs flex items-center justify-center font-bold">2</span>
                    STP Priority over LTP
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Short Term Planning (<strong className="text-blue-600 dark:text-blue-400">STP</strong>) schedules take precedence over Long Term Planning (<strong className="text-slate-600 dark:text-slate-400">LTP</strong>). If a diagram has an active STP variation on that date, it is loaded automatically.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-semibold text-slate-900 dark:text-slate-100">Full Job vs Partial Headcodes</h5>
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Claim Full Diagram:</strong> Check this option if you are accompanying or instructing the driver for their entire scheduled turn.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Claim Specific Headcodes:</strong> Uncheck "Claim Full Diagram" to select only the train trips (e.g., 9U21, 9Y54) you will cover. Multiple instructors can book separate legs of the same diagram without clashing.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Automatic Full Recognition:</strong> Selecting all available headcodes in the grid automatically claims the diagram as a full job.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-slate-900 dark:text-slate-100">Instructor Notes</h5>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Use the optional <strong>Instructor Notes</strong> field for optional operational context, such as starting points (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[11px]">From Paddington</code>) or up to (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[11px]">PNB</code>). These notes appear in both the dashboard and driver email notifications.
                </p>
              </div>
            </div>
          )}

          {/* 2. DRIVER & CUTOUT CONTACT */}
          {activeTab === 'driver' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Roster Driver & Cutout Email
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Live rostered driver lookups, Weekly vs Daily status, and one-click DI cutout emails.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Weekly vs Daily Allocation Badges</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Daily
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Weekly
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  When you select a diagram, the allocator queries the live TDtools roster database for that exact date. The tag in the top-right corner of the driver card confirms the roster publication source:
                </p>
                <ul className="text-xs space-y-1.5 pl-4 list-disc text-slate-600 dark:text-slate-300">
                  <li><strong className="text-blue-600 dark:text-blue-400">DAILY:</strong> Sourced from the Daily allocation. Daily updates supersede weekly entries (e.g., rest-day working or cover drivers).</li>
                  <li><strong className="text-purple-600 dark:text-purple-400">WEEKLY:</strong> Sourced from the base weekly roster sheet prior to daily publication.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-semibold">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>One-Click "Email Driver (Confirm email address)"</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Instructors must notify and confirm with the rostered driver whenever cutting out for instruction. Clicking the <strong>Email Driver</strong> link automatically opens your default email client with a complete, professional cutout request:
                </p>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-1 text-slate-700 dark:text-slate-300 shadow-2xs">
                  <div><strong>To:</strong> firstname.lastname@gtsr.co.uk</div>
                  <div><strong>Subject:</strong> [JobNumber] - [Date] - DI Cut out</div>
                  <div className="pt-1 text-slate-500 dark:text-slate-400 italic">
                    "Hi [Driver], Would you be happy for me to use [JobNumber] on [Date] for driver instruction..."
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  * Always double-check and confirm the recipient email address in your email client prior to sending.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-500" />
                  Fullscreen Diagram Sheet Preview
                </h5>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Click anywhere on the diagram thumbnail image to open an expanded, high-resolution view of the timetable and diagram timing page directly from TDtools, complete with the roster driver contact bar.
                </p>
              </div>
            </div>
          )}

          {/* 3. CONFLICT DETECTION */}
          {activeTab === 'conflicts' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Conflict Detection & Prevention
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How the system protects against double-bookings across full shifts and individual legs.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                  <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    <strong className="text-red-800 dark:text-red-300 text-sm block">Full-Job Conflicts</strong>
                    <p>
                      If another instructor has already claimed a full diagram, the diagram dropdown disables that option and clearly marks it as <strong>(Fully Booked)</strong>. If you attempt to submit, the platform blocks the submission to avoid clashes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    <strong className="text-amber-800 dark:text-amber-300 text-sm block">Partial Headcode Conflicts</strong>
                    <p>
                      When a diagram is partially claimed by another instructor, the diagram appears as <strong>(Partially Booked)</strong>. In the headcodes grid, already booked headcodes appear strikethrough and disabled, so you can safely select only the remaining available trips.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    <strong className="text-blue-800 dark:text-blue-300 text-sm block">Live Real-Time Synchronization</strong>
                    <p>
                      Allocations update instantly across all active instructor browser sessions via WebSockets without needing a manual browser page refresh.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. DASHBOARD & CALENDAR */}
          {activeTab === 'views' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Dashboard & Weekly Calendar
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Navigating daily allocations, editing, deleting, and reviewing your weekly roster.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                  <h5 className="font-semibold text-slate-900 dark:text-slate-100">Daily Dashboard</h5>
                  <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-600 dark:text-slate-300">
                    <li><strong>Date Navigator:</strong> Jump forward or backward by day, or click <strong>Today</strong> to return to current date.</li>
                    <li><strong>Show Only Mine:</strong> Filter the right-hand allocations list to exclusively display jobs claimed under your name.</li>
                    <li><strong>Clickable Diagram Numbers:</strong> Job numbers (e.g., <code className="font-mono">AW1104</code>) and headcodes link directly to their corresponding live page on TDtools.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                  <h5 className="font-semibold text-slate-900 dark:text-slate-100">Weekly Calendar Overview</h5>
                  <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-600 dark:text-slate-300">
                    <li><strong>7-Day Schedule View:</strong> Review all instructor commitments across Monday through Sunday.</li>
                    <li><strong>Quick Claim ("+" icon):</strong> Click the plus icon on any date header in the calendar to open the claim modal for that specific date immediately.</li>
                    <li><strong>Allocation Cards:</strong> Click any allocation card in the calendar grid to inspect headcodes, notes, roster driver details, or make edits.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                  <h5 className="font-semibold text-slate-900 dark:text-slate-100">Editing and Deleting</h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    You can modify or cancel your allocations anytime via the <strong>Pencil (Edit)</strong> or <strong>Trash (Delete)</strong> buttons on both the Dashboard and the Calendar modal. Deleting releases the shift and headcodes immediately for other instructors.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. LIVE TRAIN TRACKER (NRE) */}
          {activeTab === 'find-jobs' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Train className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Live Train Tracker (National Rail Darwin)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Staff-grade real-time train departures, TIPLOC lookups, and timetable headcodes.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Accessible via the <strong>Find Jobs</strong> button in the top navigation bar. This tool connects directly to the staff National Rail Enquiries (NRE OpenLDBSV) live feeds for the Elizabeth line network.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Live Departures & Platforms
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Search any station (e.g., Paddington, Abbey Wood, Shenfield, Heathrow) or non-passenger depot/sidings location (TIPLOCs such as <code className="font-mono text-[11px]">OLDOENG</code>, <code className="font-mono text-[11px]">ROYAOSD</code>) to view scheduled vs estimated departure times, platforms, and headcodes.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Timetable & Hourly Analytics
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      View frequency bar charts showing service densities per hour throughout the day, helping you plan cutouts and practical training trips.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                  <strong>Pro Tip:</strong> Click any four-character train headcode in the search results to immediately copy it or inspect its schedule path.
                </div>
              </div>
            </div>
          )}

          {/* 6. FAQ & TROUBLESHOOTING */}
          {activeTab === 'faq' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Frequently Asked Questions
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Quick answers to common questions and troubleshooting steps.
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    Why does a diagram say "Partially Booked"?
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Another instructor has claimed some of the train trips on this diagram. You can still claim the remaining untaken headcodes by unchecking "Full Diagram" and choosing your trips.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    How does Demo Mode protect privacy?
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    In demo mode, real roster driver names are automatically masked (e.g., <code className="font-mono text-[11px]">A**** M****** C*****</code>) on both the server and client. API credential settings are restricted so live security keys are never revealed.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    Where do diagram timetable sheets and driver names come from?
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    All diagram details, headcodes, PDF page images, and driver names sync live from TDtools.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/40 space-y-1.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    What should I do if a diagram image doesn't load?
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    The platform includes an automatic backend image proxy. If your browser blocks direct asset loading from TDtools, the server will safely retrieve and render the diagram preview image for you.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
