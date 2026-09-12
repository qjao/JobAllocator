const selectedDateStr = "2026-09-12";
const j = {
  from: "2026-05-23",
  to: "2026-12-12"
};

let valid = true;
if (selectedDateStr < j.from || selectedDateStr > j.to) {
  valid = false;
}
console.log(valid);
