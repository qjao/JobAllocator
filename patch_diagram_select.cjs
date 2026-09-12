const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const oldEffect = `        if (isFullDiagram) {
          setSelectedHeadcodeIndices(hcs.map((_, i) => i));
        }
      }
    } else {`;
const newEffect = `        if (isFullDiagram) {
          setSelectedHeadcodeIndices(hcs.map((_, i) => i));
        } else {
          setSelectedHeadcodeIndices([]);
        }
      }
    } else {`;
    
code = code.replace(oldEffect, newEffect);

const oldOnChange = `onChange={(e) => setSelectedDiagram(e.target.value)}`;
const newOnChange = `onChange={(e) => {
                  setSelectedDiagram(e.target.value);
                  setIsFullDiagram(true);
                }}`;
                
code = code.replace(oldOnChange, newOnChange);

fs.writeFileSync('src/components/DiagramSelector.tsx', code);
