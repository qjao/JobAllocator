const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target1 = `  if (apiError) {`;
const replacement1 = `  const currentJob = jobs.find(j => j.name === selectedDiagram);

  if (apiError) {`;

const target2 = `        </div>

        {selectedDiagram && availableHeadcodes.length > 0 && (`;

const replacement2 = `        </div>

        {currentJob && currentJob.pdfname && currentJob.page && (
          <div className="mt-6 mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/50">
            <img 
              src={\`https://tdtools.co.uk/roster/diagramimg.php?pdfname=\${currentJob.pdfname}&page=\${currentJob.page}\`} 
              alt={\`Diagram Preview for \${selectedDiagram}\`} 
              className="w-full h-auto object-contain max-h-[400px]" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {selectedDiagram && availableHeadcodes.length > 0 && (`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/DiagramSelector.tsx', code);
