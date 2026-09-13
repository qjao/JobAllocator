const fs = require('fs');

function addImport(file, importStr) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes(importStr)) {
    const lines = code.split('\n');
    const lastImportIndex = lines.findLastIndex(line => line.startsWith('import '));
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, importStr);
      fs.writeFileSync(file, lines.join('\n'));
      console.log(`Added import to ${file}`);
    }
  }
}

addImport('src/components/FindJobs.tsx', "import { getLondonDate } from '../lib/utils';");
addImport('src/components/MiniCalendar.tsx', "import { getLondonDate } from '../lib/utils';");

