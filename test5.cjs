const selectedDateStr = "2026-09-12";
const j = {
    name: "OC2508",
    from: "2026-05-23",
    to: "2026-12-12",
    daycode: "S"
};

let expectedDayCodes = ['2', '5'];
const depotCode = j.name.substring(0, 2);
const dayCode = j.name.substring(2, 3);
const suffix = j.name.substring(3);

let result = true;
if (j.from && j.to) {
  if (selectedDateStr < j.from || selectedDateStr > j.to) {
    result = false;
  }
}
if (expectedDayCodes.includes(dayCode)) {
   console.log("Passed day code!");
} else {
   result = false;
}
console.log(result);
