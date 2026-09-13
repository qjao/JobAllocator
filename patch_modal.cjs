const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

// 1. Add AnimatePresence and motion imports
if (!code.includes("import { motion, AnimatePresence }")) {
    code = code.replace(
        "import React, { useState, useEffect } from 'react';", 
        "import React, { useState, useEffect } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';"
    );
}

// 2. Add Maximize2 to lucide-react imports
if (!code.includes("Maximize2")) {
    code = code.replace(
        "Pencil } from 'lucide-react';", 
        "Pencil, Maximize2 } from 'lucide-react';"
    );
}

// 3. Add isPreviewOpen state
if (!code.includes("isPreviewOpen")) {
    code = code.replace(
        "const [initialized, setInitialized] = useState<boolean>(!initialAllocation);",
        "const [initialized, setInitialized] = useState<boolean>(!initialAllocation);\n  const [isPreviewOpen, setIsPreviewOpen] = useState(false);"
    );
}

// 4. Update the image block
const imageTarget = `<div className="mt-6 mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white block">
            <img 
              src={\`https://tdtools.co.uk/roster/diagramimg.php?pdfname=\${currentJob.pdfname}&page=\${currentJob.page}\`} 
              alt={\`Diagram Preview for \${selectedDiagram}\`} 
              className="w-[140%] max-w-[140%] -ml-[10%] -mb-[40%] h-auto shrink-0" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>`;

const imageReplacement = `<div className="mt-6 mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white block relative group">
            <img 
              src={\`https://tdtools.co.uk/roster/diagramimg.php?pdfname=\${currentJob.pdfname}&page=\${currentJob.page}\`} 
              alt={\`Diagram Preview for \${selectedDiagram}\`} 
              className="w-[140%] max-w-[140%] -ml-[10%] -mb-[40%] h-auto shrink-0" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="absolute top-2 right-2 p-2 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity backdrop-blur-sm shadow-sm"
              title="View full image"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>`;

code = code.replace(imageTarget, imageReplacement);

// 5. Append the modal
const endTarget = `    </div>
  );
}`;

const endReplacement = `      
      <AnimatePresence>
        {isPreviewOpen && currentJob && currentJob.pdfname && currentJob.page && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm cursor-zoom-out"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-full max-h-full rounded-xl overflow-hidden bg-white shadow-2xl flex flex-col items-center justify-center cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={\`https://tdtools.co.uk/roster/diagramimg.php?pdfname=\${currentJob.pdfname}&page=\${currentJob.page}\`} 
                alt={\`Full Preview for \${selectedDiagram}\`} 
                className="w-auto h-auto max-w-[95vw] max-h-[90vh] object-contain cursor-zoom-out" 
                referrerPolicy="no-referrer"
                onClick={() => setIsPreviewOpen(false)}
              />
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-900/50 hover:bg-slate-900/80 text-white rounded-full transition-colors backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}`;

code = code.replace(endTarget, endReplacement);

fs.writeFileSync('src/components/DiagramSelector.tsx', code);
console.log('Done!');
