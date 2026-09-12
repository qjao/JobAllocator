const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf8');

code = code.replace(
  'className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar"',
  'className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4"'
);

fs.writeFileSync('src/components/Header.tsx', code);
