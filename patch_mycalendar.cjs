const fs = require('fs');
let code = fs.readFileSync('src/components/MyCalendar.tsx', 'utf8');

const targetJSXStart = `{editingAllocation && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              Edit Allocation
            </h3>`;
const targetJSXEnd = `</form>
          </div>
        </div>
      )}`;

const startIdx = code.indexOf(targetJSXStart);
if (startIdx === -1) {
    console.log("JSX Start not found");
    process.exit(1);
}
const endIdx = code.indexOf(targetJSXEnd, startIdx);
if (endIdx === -1) {
    console.log("JSX End not found");
    process.exit(1);
}

const replacementJSX = `{editingAllocation && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="max-w-md w-full my-8 relative">
            <DiagramSelector
              darkMode={darkMode}
              selectedDate={new Date(editingAllocation.date)}
              allocations={allocations.filter(a => a.id !== editingAllocation.id)}
              onAddAllocation={async (job, isFull, hcs, notes) => {
                setEditSubmitting(true);
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(\`/api/allocations/\${editingAllocation.id}\`, {
                    method: 'PUT',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': \`Bearer \${token}\`
                    },
                    body: JSON.stringify({
                      jobNumber: job,
                      isFullJob: isFull,
                      headcodes: isFull ? [] : hcs,
                      notes: notes.trim(),
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
              }}
              formError={editFormError}
              submitting={editSubmitting}
              onCancel={() => setEditingAllocation(null)}
              title="Edit Allocation"
              initialAllocation={{
                jobNumber: editingAllocation.jobNumber,
                isFullJob: editingAllocation.isFullJob,
                headcodes: editingAllocation.headcodes,
                notes: editingAllocation.notes
              }}
            >
              {(user.role === 'admin' || user.role === 'moderator') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allocated User</label>
                  <select
                    value={editInstructorId}
                    onChange={(e) => setEditInstructorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-colors"
                    required
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </DiagramSelector>
          </div>
        </div>
      )}`;

code = code.substring(0, startIdx) + replacementJSX + code.substring(endIdx + targetJSXEnd.length);
fs.writeFileSync('src/components/MyCalendar.tsx', code);
console.log("Patched JSX successfully!");
