import React, { useState } from 'react';
import { Shield, Home, Calendar as CalendarIcon, User as UserIcon, Moon, Sun, HelpCircle, LogOut, Check, ArrowUpDown } from 'lucide-react';

interface DemoAdminUsersPageProps {
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar') => void;
  onExit: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function DemoAdminUsersPage({ onNavigate, onExit, darkMode, toggleDarkMode }: DemoAdminUsersPageProps) {
  // Static demo data
  const users = [
    { id: '1', name: 'Demo Admin', email: 'admin@example.com', role: 'admin', isApproved: true },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'instructor', isApproved: true },
    { id: '3', name: 'John Doe', email: 'john@example.com', role: 'moderator', isApproved: true },
    { id: '4', name: 'New User', email: 'new@example.com', role: 'instructor', isApproved: false }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="bg-blue-600 dark:bg-blue-800 text-white text-center py-2 text-sm font-medium">
        Demo Mode - User management is read-only.
      </div>
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-lg">
            <Shield className="w-6 h-6" />
            <span className="hidden sm:inline">Admin Dashboard</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <nav className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => onNavigate('dashboard')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Home className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => onNavigate('calendar')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <CalendarIcon className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
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
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="hidden sm:inline">Theme</span>
              </button>
              <button 
                onClick={onExit}
                className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Exit Demo</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management (Read-Only)</h1>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize transition-colors ${
                        u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' : u.role === 'moderator' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          u.isApproved 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                        }`}
                      >
                        {u.isApproved && <Check className="w-3.5 h-3.5" />}
                        {u.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 dark:text-slate-500 italic text-xs">
                      Disabled in demo
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
