const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `  useEffect(() => {
    if (selectedDiagram) {
      const job = availableDiagrams.find(j => j.name === selectedDiagram);
      if (job) {
        const key = job.isStp ? \`stp_\${job.jobid}\` : \`ltp_\${job.jobid}\`;
        const hcs = headcodesMap[key] || [];
        setAvailableHeadcodes(hcs);
        if (isFullDiagram) {
          setSelectedHeadcodeIndices(hcs.map((_, i) => i));
        }
      }
    } else {
      setAvailableHeadcodes([]);
      setSelectedHeadcodeIndices([]);
    }
  }, [selectedDiagram, jobs, headcodesMap]);`;

const replacement = `  useEffect(() => {
    if (selectedDiagram) {
      const job = availableDiagrams.find(j => j.name === selectedDiagram);
      if (job) {
        const key = job.isStp ? \`stp_\${job.jobid}\` : \`ltp_\${job.jobid}\`;
        const hcs = headcodesMap[key] || [];
        setAvailableHeadcodes(hcs);
        
        if (!initialized && initialAllocation) {
          if (initialAllocation.isFullJob) {
            setSelectedHeadcodeIndices(hcs.map((_, i) => i));
          } else {
            const indices = initialAllocation.headcodes
              .map(hc => hcs.indexOf(hc))
              .filter(i => i !== -1);
            setSelectedHeadcodeIndices(indices);
          }
          setInitialized(true);
        } else if (isFullDiagram) {
          setSelectedHeadcodeIndices(hcs.map((_, i) => i));
        }
      }
    } else {
      setAvailableHeadcodes([]);
      setSelectedHeadcodeIndices([]);
    }
  }, [selectedDiagram, jobs, headcodesMap, availableDiagrams, initialized, initialAllocation, isFullDiagram]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DiagramSelector.tsx', code);
  console.log("Patched successfully!");
} else {
  console.log("Target not found!");
}
