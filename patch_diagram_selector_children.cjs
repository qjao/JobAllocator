const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm mb-4 transition-colors">`;

const replacement = `          {children && (
            <div className="mt-4">
              {children}
            </div>
          )}
          
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400 text-sm mb-4 transition-colors">`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DiagramSelector.tsx', code);
  console.log("Patched children successfully!");
} else {
  console.log("Target not found!");
}
