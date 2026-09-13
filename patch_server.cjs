const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/page: row\.page/g, 'page: row.pdfpage');

fs.writeFileSync('server.ts', code);
