const fs = require('fs');
const csv = require('csv-parser');

const inputFile = 'pcr_testing_table1_location_agg.csv';
const outputFile = 'data/nsw_postcode_lhd_full.json';

const postcodeToLHD = {};
const postcodeCounts = {};

// STEP 1 — build best LHD per postcode (majority rule)
fs.createReadStream(inputFile)
  .pipe(csv())
  .on('data', (row) => {
    const postcode = String(row.postcode || '').trim();
    const lhd = String(row.lhd_2010_name || '').trim();

    if (!postcode || !lhd || postcode === 'NaN') return;

    if (!postcodeCounts[postcode]) {
      postcodeCounts[postcode] = {};
    }

    postcodeCounts[postcode][lhd] = (postcodeCounts[postcode][lhd] || 0) + 1;
  })
  .on('end', () => {

    // pick most frequent LHD per postcode
    for (const pc in postcodeCounts) {
      const counts = postcodeCounts[pc];
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      postcodeToLHD[pc] = best;
    }

    // STEP 2 — fill missing NSW postcode range (1000–2999)
    for (let i = 1000; i <= 2999; i++) {
      const pc = String(i);

      if (!postcodeToLHD[pc]) {
        postcodeToLHD[pc] = "UNKNOWN";
      }
    }

    fs.writeFileSync(outputFile, JSON.stringify(postcodeToLHD, null, 2));

    const total = Object.keys(postcodeToLHD).length;
    const unknown = Object.values(postcodeToLHD).filter(v => v === "UNKNOWN").length;

    console.log('===================================');
    console.log('✅ FULL NSW MAP BUILT');
    console.log('===================================');
    console.log('Total postcodes:', total);
    console.log('Mapped:', total - unknown);
    console.log('Unknown:', unknown);
    console.log('Output:', outputFile);
  })
  .on('error', (err) => {
    console.error('❌ Error:', err.message);
  });
