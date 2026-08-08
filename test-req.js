import http from 'http';

http.get('http://localhost:3000/api/board?crs=HAF&time=2026-06-30T06:23&filterCrs=PAD', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
