const fs = require('fs');
const csv = require('csv-parser');

const results = {};
const seen = new Set();
const inputFile = process.argv[2] || 'pcr_testing_table1_location_agg.csv';

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Failed to read CSV: ${inputFile}`);
  console.error('File does not exist.');
  process.exit(1);
}

const parser = csv();
parser
  .on('data', (row) => {
    const postcode = String(row.postcode).trim();
    const lhd = row.lhd_2010_name?.trim();

    if (!postcode || !lhd) return;
    if (postcode === 'NaN') return;

    // Only take first occurrence
    if (!seen.has(postcode)) {
      results[postcode] = lhd;
      seen.add(postcode);
    }
  })
  .on('end', () => {
    fs.writeFileSync(
      'data/nsw_postcode_lhd.json',
      JSON.stringify(results, null, 2)
    );

    console.log('✅ NSW postcode map created');
    console.log(`Input file: ${inputFile}`);
    console.log(`Total mapped: ${Object.keys(results).length}`);
  })
  .on('error', (err) => {
    console.error(`❌ Failed to read CSV: ${inputFile}`);
    console.error(err.message);
    process.exit(1);
  });

fs.createReadStream(inputFile)
  .on('error', (err) => {
    console.error(`❌ Failed to read CSV: ${inputFile}`);
    console.error(err.message);
    process.exit(1);
  })
  .pipe(parser);
