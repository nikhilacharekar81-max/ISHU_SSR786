const fs = require('fs');
let data = fs.readFileSync('src/data/completeSeedDataset.ts', 'utf8');

// A crude fix for the duplications caused by my bad sed commands
data = data.replace(/title: "Principal UI\/UX .*? Design Systems Lead"/g, 'title: "Principal UI/UX & Design Systems Lead"');
// ... this is too complex.
