const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Add MiniCalendar import
code = code.replace(
  "import DiagramSelector from './DiagramSelector';",
  "import DiagramSelector from './DiagramSelector';\nimport MiniCalendar from './MiniCalendar';\nimport { useRef } from 'react';"
);

// Add showDatePicker state
code = code.replace(
  "  const [loading, setLoading] = useState(true);",
  "  const [loading, setLoading] = useState(true);\n  const [showDatePicker, setShowDatePicker] = useState(false);\n  const datePickerRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    const handleClickOutside = (event: MouseEvent) => {\n      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {\n        setShowDatePicker(false);\n      }\n    };\n    if (showDatePicker) {\n      document.addEventListener('mousedown', handleClickOutside);\n    }\n    return () => {\n      document.removeEventListener('mousedown', handleClickOutside);\n    };\n  }, [showDatePicker]);"
);

// Modify the date display
const oldDateDisplay = `<div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
              <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-400" />
              {format(selectedDate, 'MMM d, yyyy')}
            </div>`;

const newDateDisplay = `<div className="relative" ref={datePickerRef}>
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors"
              >
                <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-400" />
                {format(selectedDate, 'MMM d, yyyy')}
              </button>
              
              {showDatePicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <MiniCalendar 
                    selectedDate={selectedDate} 
                    onSelectDate={(date) => {
                      setSelectedDate(date);
                      setShowDatePicker(false);
                    }} 
                  />
                </div>
              )}
            </div>`;

code = code.replace(oldDateDisplay, newDateDisplay);

fs.writeFileSync('src/components/Dashboard.tsx', code);
