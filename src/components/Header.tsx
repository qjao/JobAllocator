import React from 'react';
import { Train, Calendar as CalendarIcon, Shield, User as UserIcon, Sun, Moon, Search, LogOut, Home, HelpCircle } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  currentView: 'dashboard' | 'admin' | 'profile' | 'calendar' | 'find-jobs';
  onNavigate: (view: 'dashboard' | 'admin' | 'profile' | 'calendar' | 'find-jobs') => void;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onHelp?: () => void;
  children?: React.ReactNode;
}

export default function Header({ user, currentView, onNavigate, onLogout, darkMode, toggleDarkMode, onHelp, children }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div 
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-lg shrink-0 cursor-pointer"
          onClick={() => onNavigate('dashboard')}
        >
          <Train className="w-6 h-6" />
          <span className="hidden lg:inline">Instructor Job Allocator</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {children}

          <nav className="flex items-center gap-2 sm:gap-4 ml-2">
            {currentView !== 'dashboard' && (
              <button 
                onClick={() => onNavigate('dashboard')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Home className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}
            {currentView !== 'find-jobs' && (
              <button 
                onClick={() => onNavigate('find-jobs')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Search className="w-4 h-4" /> <span className="hidden sm:inline">Find Jobs</span>
              </button>
            )}
            {currentView !== 'calendar' && (
              <button 
                onClick={() => onNavigate('calendar')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <CalendarIcon className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
              </button>
            )}
            {(user.role === 'admin' || user.role === 'moderator') && currentView !== 'admin' && (
              <button 
                onClick={() => onNavigate('admin')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            {currentView !== 'profile' && (
              <button 
                onClick={() => onNavigate('profile')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <UserIcon className="w-4 h-4" /> <span className="hidden sm:inline">Profile</span>
              </button>
            )}
            
            <button 
              onClick={toggleDarkMode}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden sm:inline">Theme</span>
            </button>

            {onHelp && (
              <button 
                onClick={onHelp}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Help</span>
              </button>
            )}
            
            <button 
              onClick={onLogout}
              className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 ml-2"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
