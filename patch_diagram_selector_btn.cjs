const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `{submitting ? 'Adding...' : 'Add Allocation'}`;
const replacement = `{submitting ? 'Saving...' : (initialAllocation ? 'Save Changes' : 'Add Allocation')}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DiagramSelector.tsx', code);
  console.log("Patched button text successfully!");
} else {
  console.log("Target not found!");
}
