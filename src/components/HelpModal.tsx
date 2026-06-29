import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            How to use the Allocator
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-6 text-slate-600 dark:text-slate-300">
          <section>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Claiming Jobs</h4>
            <p className="text-sm mb-2">
              You can claim full or partial jobs for any given day from the Dashboard or by clicking the "+" icon next to a date in the Calendar.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Full Job:</strong> Check the "Full Job" box if you are covering the entire shift.</li>
              <li><strong>Partial Job:</strong> If you are only covering part of a job, uncheck "Full Job" and specify the headcodes you are covering.</li>
              <li><strong>Notes:</strong> If you need to add any extra information use this field: E.g.: "From Paddington only."</li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Conflict Detection</h4>
            <p className="text-sm">
              The system automatically checks for previously booked jobs. If someone else has already claimed the same job number on the same day, you will see a warning. This helps prevent double-booking.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Editing and Deleting</h4>
            <p className="text-sm mb-2">
              You can edit or delete your own allocations from the Dashboard or from the weekly calendar.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Edit:</strong> Click the pencil icon or "Edit" button to modify the job number, headcodes, or notes. In the Calendar, click on an allocation to view its details and access the Edit button.</li>
              <li><strong>Delete:</strong> Click the trash icon or "Delete" button to remove an allocation. You will be asked to confirm. In the Calendar, click on an allocation to view its details and access the Delete button.</li>
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">TDTools Integration</h4>
            <p className="text-sm">
              Job numbers in the allocation list are clickable links. Clicking a job number will open the corresponding job details in TDTools in a new tab.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Navigation</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Dashboard:</strong> View daily allocations and add new ones.</li>
              <li><strong>Calendar:</strong> View, add or delete allocations on a weekly overview.</li>
              <li><strong>Profile:</strong> Update your name, email, or password.</li>
            </ul>
          </section>
        </div>
        
        <div className="mt-8 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
