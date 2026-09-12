const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `      setAvailableDiagrams(Array.from(dedupedMap.values()));
      setSelectedDiagram('');
      setAvailableHeadcodes([]);
      setSelectedHeadcodeIndices([]);
    }
  }, [selectedDepot, jobs, selectedDate]);`;

const replacement = `      setAvailableDiagrams(Array.from(dedupedMap.values()));
      setSelectedDiagram(prev => {
        if (prev && prev.startsWith(selectedDepot)) return prev;
        setAvailableHeadcodes([]);
        setSelectedHeadcodeIndices([]);
        return '';
      });
    } else {
      setAvailableDiagrams([]);
    }
  }, [selectedDepot, jobs, selectedDate]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DiagramSelector.tsx', code);
  console.log("Patched depot reset successfully!");
} else {
  console.log("Target not found!");
}
