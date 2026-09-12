const fs = require('fs');
let code = fs.readFileSync('src/components/DiagramSelector.tsx', 'utf8');

const target = `  useEffect(() => {
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
  }, [selectedDiagram, jobs, headcodesMap, availableDiagrams, initialized, initialAllocation, isFullDiagram]);

  useEffect(() => {
    if (isFullDiagram && availableHeadcodes.length > 0 && !isPartiallyBooked) {
      setSelectedHeadcodeIndices(availableHeadcodes.map((_, i) => i));
    } else if (!isFullDiagram && availableHeadcodes.length > 0 && selectedHeadcodeIndices.length === availableHeadcodes.length) {
      // If it was full, but user unchecks full diagram natively (not by clicking a child)
      setSelectedHeadcodeIndices([]);
    }
  }, [isFullDiagram, availableHeadcodes, isPartiallyBooked]);

  const handleHeadcodeToggle = (idx: number) => {
    if (isFullDiagram) {
      setIsFullDiagram(false);
      setSelectedHeadcodeIndices([idx]);
    } else {
      let newSelection = [...selectedHeadcodeIndices];
      if (newSelection.includes(idx)) {
        newSelection = newSelection.filter(i => i !== idx);
      } else {
        newSelection.push(idx);
      }
      setSelectedHeadcodeIndices(newSelection);
    }
  };

  const handleFullDiagramToggle = () => {
    setIsFullDiagram(!isFullDiagram);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagram) return;
    
    const headcodesToSubmit = isFullDiagram 
      ? [] 
      : selectedHeadcodeIndices.map(idx => availableHeadcodes[idx]);

    await onAddAllocation(
      selectedDiagram,
      isFullDiagram,
      headcodesToSubmit,
      notesInput
    );
    
    // Reset form after successful submit
    setSelectedDiagram('');
    setSelectedDepot('');
    setIsFullDiagram(true);
    setNotesInput('');
    if (onCancel) onCancel();
  };`;

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
            setIsFullDiagram(true);
          } else {
            const indices = initialAllocation.headcodes
              .map(hc => hcs.indexOf(hc))
              .filter(i => i !== -1);
            setSelectedHeadcodeIndices(indices);
            if (indices.length === hcs.length && hcs.length > 0) {
              setIsFullDiagram(true);
            } else {
              setIsFullDiagram(false);
            }
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
  }, [selectedDiagram, jobs, headcodesMap, availableDiagrams, initialized, initialAllocation]);

  const handleHeadcodeToggle = (idx: number) => {
    if (isFullDiagram) {
      setIsFullDiagram(false);
      setSelectedHeadcodeIndices([idx]);
    } else {
      let newSelection = [...selectedHeadcodeIndices];
      if (newSelection.includes(idx)) {
        newSelection = newSelection.filter(i => i !== idx);
      } else {
        newSelection.push(idx);
      }
      setSelectedHeadcodeIndices(newSelection);
      if (newSelection.length === availableHeadcodes.length && availableHeadcodes.length > 0) {
        setIsFullDiagram(true);
      }
    }
  };

  const handleFullDiagramToggle = () => {
    const nextState = !isFullDiagram;
    setIsFullDiagram(nextState);
    if (nextState) {
      setSelectedHeadcodeIndices(availableHeadcodes.map((_, i) => i));
    } else {
      setSelectedHeadcodeIndices([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagram) return;
    
    // Automatically treat it as a full diagram if all headcodes are selected
    const allSelected = selectedHeadcodeIndices.length === availableHeadcodes.length && availableHeadcodes.length > 0;
    const submitAsFull = isFullDiagram || allSelected;
    
    const headcodesToSubmit = submitAsFull 
      ? [] 
      : selectedHeadcodeIndices.map(idx => availableHeadcodes[idx]);

    await onAddAllocation(
      selectedDiagram,
      submitAsFull,
      headcodesToSubmit,
      notesInput
    );
    
    // Reset form after successful submit
    setSelectedDiagram('');
    setSelectedDepot('');
    setIsFullDiagram(true);
    setNotesInput('');
    if (onCancel) onCancel();
  };`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DiagramSelector.tsx', code);
  console.log("Patched successfully!");
} else {
  console.log("Target not found!");
}
