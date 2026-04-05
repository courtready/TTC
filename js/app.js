let postcodeData = [];
let dataLoaded = false;

// Load data safely
async function loadPostcodes() {
  try {
    const res = await fetch('nsw-postcodes.json');
    postcodeData = await res.json();
    dataLoaded = true;
    console.log("Postcodes loaded:", postcodeData.length);
  } catch (err) {
    console.error("Failed to load postcodes:", err);
  }
}

// Clean input
function cleanInput(input) {
  return input.trim().toLowerCase();
}

// Find suburb/postcode
function findLocation(input) {
  input = cleanInput(input);

  return postcodeData.find(item => {
    const suburb = item.suburb.toLowerCase();
    return (
      item.postcode === input ||
      suburb === input ||
      suburb.includes(input)
    );
  });
}

// MAIN FUNCTION
function showImpact() {
  if (!dataLoaded) {
    alert("Still loading data, try again in a second.");
    return;
  }

  const inputEl = document.getElementById('locationInput');
  const resultEl = document.getElementById('result');

  if (!inputEl || !resultEl) {
    console.error("Missing input or result element");
    return;
  }

  const input = inputEl.value;
  const match = findLocation(input);

  if (!match) {
    resultEl.innerHTML = "<p>Location not found.</p>";
    return;
  }

  // Get sliders (if they exist)
  const nurseBudget = document.getElementById('nurseBudget')?.value || 50;
  const nurseRise = document.getElementById('nurseRise')?.value || 0;
  const teacherRise = document.getElementById('teacherRise')?.value || 0;

  resultEl.innerHTML = `
    <h3>${match.suburb} (${match.postcode})</h3>
    <p>Budget split: ${nurseBudget}% nurses</p>
    <p>Nurses pay rise: ${nurseRise}%</p>
    <p>Teachers pay rise: ${teacherRise}%</p>
  `;
}

// Ensure everything loads AFTER page
document.addEventListener("DOMContentLoaded", () => {
  loadPostcodes();

  // Hook button safely
  const btn = document.getElementById('impactBtn');
  if (btn) {
    btn.addEventListener('click', showImpact);
  }
});