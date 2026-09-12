const fs = require('fs');
let code = fs.readFileSync('src/components/MyCalendar.tsx', 'utf8');

// replace openEditModal
const targetOpenEditModal = `  const openEditModal = (alloc: Allocation) => {
    setEditingAllocation(alloc);
    setEditJobNumber(alloc.jobNumber);
    setEditIsFullJob(alloc.isFullJob);
    setEditHeadcodesInput(alloc.headcodes ? alloc.headcodes.join(', ') : '');
    setEditNotesInput(alloc.notes || '');
    setEditInstructorId(alloc.instructorId);
    setShowEditNotes(!!alloc.notes);
    setEditFormError('');
  };`;
const replacementOpenEditModal = `  const openEditModal = (alloc: Allocation) => {
    setEditingAllocation(alloc);
    setEditInstructorId(alloc.instructorId);
    setEditFormError('');
  };`;

if (code.includes(targetOpenEditModal)) {
  code = code.replace(targetOpenEditModal, replacementOpenEditModal);
  fs.writeFileSync('src/components/MyCalendar.tsx', code);
  console.log('Cleaned up openEditModal');
} else {
  console.log('openEditModal not found');
}
