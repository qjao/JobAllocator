const fs = require('fs');
const ltpRes = fs.readFileSync('data/r_jobs.csv', 'utf8');
const stpRes = fs.readFileSync('data/r_jobs_stp.csv', 'utf8');
const parseCsv = (content) => {
        const lines = content.split('\n');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((h, i) => obj[h] = values[i]);
          return obj;
        });
      };

const ltpData = parseCsv(ltpRes).map((row) => ({
        jobid: row.jobid,
        name: row.name,
        priority: parseInt(row.priority || '10'),
        daycode: row.daycode,
        isStp: false,
        from: row.from,
        to: row.to
      }));

const ocLtp = ltpData.filter(j => j.name === 'OC2508');
console.log("OC2508 LTP:", ocLtp);

const stpData = parseCsv(stpRes).map((row) => ({
        jobid: row.jobid,
        name: row.name,
        priority: parseInt(row.priority || '10'),
        daycode: row.daycode,
        isStp: true,
        from: row.from,
        to: row.to
      }));
const ocStp = stpData.filter(j => j.name === 'OC2508');
console.log("OC2508 STP:", ocStp);

