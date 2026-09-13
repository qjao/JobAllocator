const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `<div className="mt-6 mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/50">
            <img 
              src={\`https://tdtools.co.uk/roster/diagramimg.php?pdfname=\${currentJob.pdfname}&page=\${currentJob.page}\`} 
              alt={\`Diagram Preview for \${selectedDiagram}\`} 
              className="w-full h-auto object-contain max-h-[400px]" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>`;

const replacement = `<div className="mt-6 mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white flex justify-center">
            <img 
              src={\`https://tdtools.co.uk/roster/diagramimg.php?pdfname=\${currentJob.pdfname}&page=\${currentJob.page}\`} 
              alt={\`Diagram Preview for \${selectedDiagram}\`} 
              className="w-[135%] max-w-[135%] h-auto shrink-0" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>`;

if(code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/components/DiagramSelector.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Target not found!");
}
