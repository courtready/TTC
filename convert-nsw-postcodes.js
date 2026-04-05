const fs = require('fs');
const csv = require('csv-parser');

const results = [];
const seen = new Set();

fs.createReadStream('australian_postcodes.csv')
  .pipe(csv())
  .on('data', (data) => {
    if (data.state === 'NSW') {

      const suburb = data.locality.trim();
      const postcode = data.postcode.trim();

      const key = suburb + '-' + postcode;

      // remove duplicates
      if (!seen.has(key)) {
        seen.add(key);

        results.push({
          suburb: suburb,
          postcode: postcode,
          electorate: (data.electorate || "").trim()
        });
      }
    }
  })
  .on('end', () => {

    // sort cleanly
    results.sort((a, b) => {
      if (a.postcode === b.postcode) {
        return a.suburb.localeCompare(b.suburb);
      }
      return a.postcode.localeCompare(b.postcode);
    });

    fs.writeFileSync(
      'nsw-postcodes.json',
      JSON.stringify(results, null, 2)
    );

    console.log(`Done. ${results.length} NSW entries created.`);
  });
