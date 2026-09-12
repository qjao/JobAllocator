fetch('http://localhost:3000/api/diagrams', { headers: { 'Authorization': 'Bearer ' + (process.env.TEST_TOKEN || 'dummy') } })
  .then(r => r.json())
  .then(d => {
     if (d.jobs) {
       console.log("Jobs count:", d.jobs.length);
       const oc = d.jobs.filter(j => j.name === 'OC2508');
       console.log("OC2508:", oc);
     } else {
       console.log("Response:", d);
     }
  })
  .catch(console.error);
