const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const target = `    };

    fetchUsers();`;

const replacement = `    };

    fetchAllocations();
    fetchUsers();`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Dashboard.tsx', code);
