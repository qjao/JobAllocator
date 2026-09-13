import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLondonDate } from '../lib/utils';

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export default function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="w-64 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {format(currentMonth, dateFormat)}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, getLondonDate());

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              className={cn(
                "h-8 w-full rounded-md flex items-center justify-center text-sm transition-colors",
                !isCurrentMonth && "text-slate-300 dark:text-slate-600",
                isCurrentMonth && !isSelected && "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
                isSelected && "bg-blue-600 text-white font-bold shadow-sm",
                isToday && !isSelected && "border border-blue-500 text-blue-600 dark:text-blue-400 font-bold"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
      
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={() => {
            setCurrentMonth(startOfMonth(getLondonDate()));
            onSelectDate(getLondonDate());
          }}
          className="w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-md transition-colors"
        >
          Go to Today
        </button>
      </div>
    </div>
  );
}
