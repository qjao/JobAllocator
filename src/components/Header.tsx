import React, { useState, useRef, useEffect } from 'react';
import { Train, Calendar as CalendarIcon, Shield, User as UserIcon, Sun, Moon, Search, LogOut, Home, HelpCircle, Menu, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const handleNav = (view: 'dashboard' | 'admin' | 'profile' | 'calendar' | 'find-jobs') => {
    onNavigate(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4 relative">
        {/* Left */}
        <div 
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-lg shrink-0 cursor-pointer z-10"
          onClick={() => handleNav('dashboard')}
        >
          <Train className="w-6 h-6" />
          <span className="hidden lg:inline">Instructor Job Allocator</span>
        </div>

        {/* Center */}
        {children && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-0">
            {children}
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 z-10 ml-auto">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2 sm:gap-4 ml-2">
            {currentView !== 'dashboard' && (
              <button 
                onClick={() => handleNav('dashboard')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Home className="w-4 h-4" /> <span>Dashboard</span>
              </button>
            )}
            {currentView !== 'find-jobs' && (
              <button 
                onClick={() => handleNav('find-jobs')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Search className="w-4 h-4" /> <span>Find Jobs</span>
              </button>
            )}
            {currentView !== 'calendar' && (
              <button 
                onClick={() => handleNav('calendar')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <CalendarIcon className="w-4 h-4" /> <span>Calendar</span>
              </button>
            )}
            {(user.role === 'admin' || user.role === 'moderator') && currentView !== 'admin' && (
              <button 
                onClick={() => handleNav('admin')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Shield className="w-4 h-4" /> <span>Admin</span>
              </button>
            )}
            {currentView !== 'profile' && (
              <button 
                onClick={() => handleNav('profile')} 
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <UserIcon className="w-4 h-4" /> <span>Profile</span>
              </button>
            )}
            
            <button 
              onClick={toggleDarkMode}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>Theme</span>
            </button>

            {onHelp && (
              <button 
                onClick={onHelp}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Help</span>
              </button>
            )}
            
            <button 
              onClick={onLogout}
              className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 ml-2"
            >
              <LogOut className="w-4 h-4" /> <span>Logout</span>
            </button>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div ref={menuRef} className="md:hidden absolute top-16 right-4 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 flex flex-col z-40">
          {currentView !== 'dashboard' && (
            <button 
              onClick={() => handleNav('dashboard')} 
              className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Home className="w-4 h-4" /> Dashboard
            </button>
          )}
          {currentView !== 'find-jobs' && (
            <button 
              onClick={() => handleNav('find-jobs')} 
              className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Find Jobs
            </button>
          )}
          {currentView !== 'calendar' && (
            <button 
              onClick={() => handleNav('calendar')} 
              className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <CalendarIcon className="w-4 h-4" /> Calendar
            </button>
          )}
          {(user.role === 'admin' || user.role === 'moderator') && currentView !== 'admin' && (
            <button 
              onClick={() => handleNav('admin')} 
              className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Shield className="w-4 h-4" /> Admin
            </button>
          )}
          {currentView !== 'profile' && (
            <button 
              onClick={() => handleNav('profile')} 
              className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" /> Profile
            </button>
          )}
          
          <button 
            onClick={() => { toggleDarkMode(); setIsMobileMenuOpen(false); }}
            className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          {onHelp && (
            <button 
              onClick={() => { onHelp(); setIsMobileMenuOpen(false); }}
              className="px-4 py-2 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4" /> Help
            </button>
          )}
          
          <div className="my-1 border-t border-slate-200 dark:border-slate-700"></div>
          
          <button 
            onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
            className="px-4 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </header>
  );
}
