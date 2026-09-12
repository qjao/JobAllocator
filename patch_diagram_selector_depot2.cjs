const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `      setAvailableDiagrams(Array.from(dedupedMap.values()));
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

const replacement = `      setAvailableDiagrams(Array.from(dedupedMap.values()));
    } else {
      setAvailableDiagrams([]);
    }
  }, [selectedDepot, jobs, selectedDate]);

  useEffect(() => {
    if (selectedDiagram && selectedDepot && !selectedDiagram.startsWith(selectedDepot)) {
      setSelectedDiagram('');
      setAvailableHeadcodes([]);
      setSelectedHeadcodeIndices([]);
    }
  }, [selectedDepot, selectedDiagram]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DiagramSelector.tsx', code);
  console.log("Patched depot reset 2 successfully!");
} else {
  console.log("Target not found!");
}
