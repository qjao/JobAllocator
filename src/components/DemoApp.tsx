import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Allocation } from '../types';
import DemoDashboard from './DemoDashboard';
import DemoAdminUsersPage from './DemoAdminUsersPage';
import DemoCalendar from './DemoCalendar';

interface DemoAppProps {
  onExit: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function DemoApp({ onExit, darkMode, toggleDarkMode }: DemoAppProps) {
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin' | 'calendar' | 'profile'>('dashboard');

  const currentDate = new Date();
  
  const [allocations, setAllocations] = useState<Allocation[]>(() => {
    const getValidJob = (depotCode: 'AW'|'GP'|'IF'|'MH'|'OC'|'PU'|'SH', date: Date, suffix: string) => {
      const validDepots = { 'AW': '1', 'GP': '2', 'IF': '3', 'MH': '4', 'OC': '5', 'PU': '6', 'SH': '7' };
      const dayOfWeek = date.getDay();
      let dayCode = '1';
      if (dayOfWeek === 6) dayCode = '2';
      else if (dayOfWeek === 0) dayCode = '3';
      return `${depotCode}${dayCode}${validDepots[depotCode]}${suffix}`;
    };

    const dMinus1 = addDays(currentDate, -1);
    const dPlus1 = addDays(currentDate, 1);
    const dPlus2 = addDays(currentDate, 2);

    return [
      {
        id: 'demo-1',
        date: format(currentDate, 'yyyy-MM-dd'),
        jobNumber: getValidJob('AW', currentDate, '01'),
        isFullJob: true,
        headcodes: [],
        notes: '',
        instructorId: '999',
        instructorName: 'Demo User',
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'demo-2',
        date: format(currentDate, 'yyyy-MM-dd'),
        jobNumber: getValidJob('GP', currentDate, '05'),
        isFullJob: false,
        headcodes: ['1A23', '2B45'],
        notes: 'From PNB',
        instructorId: '100',
        instructorName: 'Jane Smith',
        createdAt: Date.now() - 7200000,
      },
      {
        id: 'demo-3',
        date: format(dPlus1, 'yyyy-MM-dd'),
        jobNumber: getValidJob('IF', dPlus1, '11'),
        isFullJob: true,
        headcodes: [],
        notes: '',
        instructorId: '999',
        instructorName: 'Demo User',
        createdAt: Date.now() - 86400000,
      },
      {
        id: 'demo-4',
        date: format(dPlus2, 'yyyy-MM-dd'),
        jobNumber: getValidJob('MH', dPlus2, '90'),
        isFullJob: false,
        headcodes: ['9Z99'],
        notes: 'Up to PNB',
        instructorId: '101',
        instructorName: 'John Doe',
        createdAt: Date.now() - 172800000,
      },
      {
        id: 'demo-5',
        date: format(dMinus1, 'yyyy-MM-dd'),
        jobNumber: getValidJob('OC', dMinus1, '33'),
        isFullJob: true,
        headcodes: [],
        notes: '',
        instructorId: '100',
        instructorName: 'Jane Smith',
        createdAt: Date.now() - 259200000,
      },
      {
        id: 'demo-6',
        date: format(currentDate, 'yyyy-MM-dd'),
        jobNumber: getValidJob('GP', currentDate, '05'),
        isFullJob: false,
        headcodes: ['5C66', '6D77'],
        notes: 'Up to PNB',
        instructorId: '102',
        instructorName: 'Mike Johnson',
        createdAt: Date.now() - 3600000,
      }
    ];
  });

  if (currentView === 'admin') {
    return <DemoAdminUsersPage onNavigate={setCurrentView} onExit={onExit} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  if (currentView === 'calendar') {
    return <DemoCalendar onNavigate={setCurrentView} onExit={onExit} darkMode={darkMode} toggleDarkMode={toggleDarkMode} allocations={allocations} setAllocations={setAllocations} />;
  }

  return (
    <DemoDashboard 
      onNavigate={setCurrentView} 
      onExit={onExit} 
      darkMode={darkMode} 
      toggleDarkMode={toggleDarkMode} 
      allocations={allocations} 
      setAllocations={setAllocations} 
    />
  );
}
