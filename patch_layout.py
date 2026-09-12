import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

target = r"""                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <a 
                            href={`https://tdtools.co.uk/roster/diagram.php\?action=date&date=\$\{alloc\.date\}&name=\$\{alloc\.jobNumber\}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-mono tracking-tight"
                          >
                            \{alloc\.jobNumber\}
                          </a>
                          \{alloc\.isFullJob \? \(
                            <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0\.5 rounded transition-colors">
                              <CheckCircle2 className="w-3 h-3" /> Full Job
                            </span>
                          \) : \(
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0\.5 rounded transition-colors">
                              Partial Job
                            </span>
                          \)\}
                        </div>
                        
                        <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                          Claimed by <span className="font-medium text-slate-900 dark:text-slate-100">\{alloc\.instructorName\}</span>
                          \{isMine && <span className="text-blue-600 dark:text-blue-400 ml-1">\(You\)</span>\}
                        </div>

                        \{!alloc\.isFullJob && alloc\.headcodes\.length > 0 && \(
                          <div className="flex flex-wrap gap-1\.5">
                            \{alloc\.headcodes\.map\(\(hc, idx\) => \(
                              <a 
                                key={`\$\{hc\}-\$\{idx\}`}
                                href={`https://tdtools.co.uk/roster/headcode.php\?action=headcode-list&date=\$\{alloc\.date\}&headcode=\$\{hc\}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 font-mono text-xs px-2 py-1 rounded-md transition-colors block"
                              >
                                \{hc\}
                              </a>
                            \)\)\}
                          </div>
                        \)\}

                        \{alloc\.notes && \(
                          <div className="mt-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2\.5 rounded-lg border border-slate-100 dark:border-slate-600 transition-colors">
                            <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider block mb-1">Notes</span>
                            \{alloc\.notes\}
                          </div>
                        \)\}

                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-3 flex items-center gap-2">
                          \{alloc\.createdAt && <span>Allocated at \{formatTime\(alloc\.createdAt\)\}</span>\}
                          \{alloc\.updatedAt && <span>• Edited at \{formatTime\(alloc\.updatedAt\)\}</span>\}
                        </div>
                      </div>

                      \{\(isMine \|\| user\.role === 'admin' \|\| user\.role === 'moderator'\) && \(
                        <div className="flex items-center gap-1">
                          <button
                            onClick=\{() => openEditModal\(alloc\)\}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit allocation"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick=\{() => setDeleteConfirmId\(alloc\.id\)\}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete allocation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      \)\}
                    </div>"""

replacement = """                    <div className="flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-4">
                          <div className="shrink-0">
                            <div className="flex items-center gap-2 mb-1">
                              <a 
                                href={`https://tdtools.co.uk/roster/diagram.php?action=date&date=${alloc.date}&name=${alloc.jobNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-mono tracking-tight"
                              >
                                {alloc.jobNumber}
                              </a>
                              {alloc.isFullJob ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded transition-colors">
                                  <CheckCircle2 className="w-3 h-3" /> Full Job
                               </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded transition-colors">
                                  Partial Job
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                              Claimed by <span className="font-medium text-slate-900 dark:text-slate-100">{alloc.instructorName}</span>
                              {isMine && <span className="text-blue-600 dark:text-blue-400 ml-1">(You)</span>}
                            </div>

                            {!alloc.isFullJob && alloc.headcodes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {alloc.headcodes.map((hc, idx) => (
                                  <a 
                                    key={`${hc}-${idx}`}
                                    href={`https://tdtools.co.uk/roster/headcode.php?action=headcode-list&date=${alloc.date}&headcode=${hc}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 font-mono text-xs px-2 py-1 rounded-md transition-colors block"
                                  >
                                    {hc}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {alloc.notes && (
                            <div className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-600 transition-colors">
                              <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider block mb-1">Notes</span>
                              <span className="whitespace-pre-wrap break-words">{alloc.notes}</span>
                            </div>
                          )}
                        </div>

                        {(isMine || user.role === 'admin' || user.role === 'moderator') && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditModal(alloc)}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Edit allocation"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(alloc.id)}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete allocation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
                        {alloc.createdAt && <span>Allocated at {formatTime(alloc.createdAt)}</span>}
                        {alloc.updatedAt && <span>• Edited at {formatTime(alloc.updatedAt)}</span>}
                      </div>
                    </div>"""

content = re.sub(target, replacement, content)
with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)

print("Replaced!")
