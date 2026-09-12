const fs = require('fs');
let code = fs.readFileSync('src/components/MyCalendar.tsx', 'utf8');

// replace handleEditSubmit entirely
const startIdx = code.indexOf('  const handleEditSubmit = async (e: React.FormEvent) => {');
if (startIdx !== -1) {
    const endStr = '    }\n  };\n';
    let endIdx = code.indexOf(endStr, startIdx);
    if (endIdx !== -1) {
        endIdx += endStr.length;
        code = code.substring(0, startIdx) + code.substring(endIdx);
        fs.writeFileSync('src/components/MyCalendar.tsx', code);
        console.log("Removed handleEditSubmit");
    }
}
