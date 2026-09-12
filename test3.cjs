const content = `jobid,bundle,name,start,end,from,to,pdfname,pdfpage,tag,added,priority,type,notes,daycode
10409,2026m,OC2508,05:06:00,13:37:00,2025-12-20,2026-05-16,pdf,453,tag,date,10,NULL,NULL,S
24085,2026m,OC2508,05:06:00,13:37:00,2026-05-23,2026-12-12,pdf,453,tag,date,10,NULL,NULL,S`;

const lines = content.split('\n');
const headers = lines[0].split(',').map(h => h.trim());
const data = lines.slice(1).filter(l => l.trim()).map(line => {
  const values = line.split(',');
  const obj = {};
  headers.forEach((h, i) => obj[h] = values[i]);
  return obj;
});
console.log(data);
