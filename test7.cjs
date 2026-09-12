const jobs = [
  { jobid: "10409", name: "OC2508", from: "2025-12-20", to: "2026-05-16", isStp: false },
  { jobid: "24085", name: "OC2508", from: "2026-05-23", to: "2026-12-12", isStp: false }
];

const selectedDepot = "OC";
const selectedDate = new Date("2026-09-12T12:00:00Z");

const dayOfWeek = selectedDate.getDay(); // 6 (Saturday)
let expectedDayCodes = [];
if (dayOfWeek >= 1 && dayOfWeek <= 5) {
  expectedDayCodes = ['1', '4'];
} else if (dayOfWeek === 6) {
  expectedDayCodes = ['2', '5'];
} else if (dayOfWeek === 0) {
  expectedDayCodes = ['3', '6'];
}

const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

const exceptionSuffixes = {
  'GP': ['001'],
  'IF': ['002']
};

const filtered = jobs.filter(j => {
  if (!j.name.startsWith(selectedDepot)) return false;
  
  if (j.from && j.to) {
    if (selectedDateStr < j.from || selectedDateStr > j.to) {
      return false;
    }
  }
  
  const depotCode = j.name.substring(0, 2);
  const dayCode = j.name.substring(2, 3);
  const suffix = j.name.substring(3);
  
  if (exceptionSuffixes[depotCode]?.includes(suffix)) {
    return true;
  }
  
  return expectedDayCodes.includes(dayCode);
});

console.log("Filtered:", filtered);
