const content = `jobid,name,cancel,start,end,from,to,pdfname,pdfpage,tag,added,priority,type,notes,daycode,toc
79953,OC2508,0,2026-03-14,2026-03-14,10,S`;

const lines = content.split('\n');
const headers = lines[0].split(',').map(h => h.trim());
const data = lines.slice(1).filter(l => l.trim()).map(line => {
  const values = line.split(',');
  const obj = {};
  headers.forEach((h, i) => obj[h] = values[i]);
  return obj;
});
console.log(data);
