const SUPABASE_URL = "https://umouqdubdlqaofqukawa.supabase.co";
const SUPABASE_KEY = "sb_publishable_KrtpOdAseDSNshcJXTW6OQ_krHEXClV";
const SUPABASE_TABLE = "subscribers";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

document.addEventListener('DOMContentLoaded', function () {

  window.calculateImpact = function() {
    var input = document.getElementById("postcode").value.trim().toLowerCase();
    var result = document.getElementById("impact-result");
    if (!result) return;
    if (!input) {
      result.innerHTML = "Enter a postcode or suburb";
      return;
    }
    var map = {
      "2000": "Sydney", "2010": "Sydney", "2020": "Heffron", "2031": "Coogee",
      "2034": "Coogee", "2040": "Summer Hill", "2041": "Balmain", "2042": "Newtown",
      "newtown": "Newtown", "2044": "Summer Hill", "summer hill": "Summer Hill",
      "2050": "Balmain", "2060": "North Shore", "2065": "Lane Cove",
      "2070": "Willoughby", "2088": "Manly", "2095": "Manly",
      "2130": "Strathfield", "2140": "Auburn", "2145": "Seven Hills",
      "2150": "Parramatta", "parramatta": "Parramatta", "2155": "Kellyville",
      "2160": "Fairfield", "2170": "Liverpool", "2200": "Bankstown",
      "2204": "Canterbury", "2217": "Kogarah", "2220": "Miranda", "2229": "Cronulla"
    };
    var electorate = map[input];
    if (!electorate) {
      result.innerHTML =
        "<strong>" + input + "</strong><br><br>" +
        "Across NSW:<br>" +
        "\u2248 150 nurses per electorate<br>" +
        "\u2248 130 teachers per electorate<br><br>" +
        "<em>Electorate data expanding.</em>";
      return;
    }
    result.innerHTML =
      "<strong>" + input + "</strong><br>" +
      "Electorate: <strong>" + electorate + "</strong><br><br>" +
      "This policy could fund:<br><br>" +
      "\u2022 150 nurses in your area<br>" +
      "\u2022 130 teachers in your area<br><br>" +
      "<strong>Instead, that money is currently untaxed.</strong>";
  };

  async function saveSignup(email, source) {
    if (!supabaseClient) {
      alert("Signup is temporarily unavailable.");
      return false;
    }

    var cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      alert("Please enter a valid email.");
      return false;
    }

    var response = await supabaseClient
      .from(SUPABASE_TABLE)
      .insert([{ email: cleanEmail, source: source }]);

    if (response.error) {
      alert("Could not save your signup right now. Please try again.");
      return false;
    }

    return true;
  }

  var joinBtn = document.querySelector('.join-form button');
  if (joinBtn) {
    joinBtn.addEventListener('click', async function() {
      var email = document.getElementById('join-email');
      if (email && email.value) {
        var ok = await saveSignup(email.value, "join-section");
        if (ok) {
          email.value = "";
          alert("Thanks! We will be in touch.");
        }
      }
    });
  }

  window.handleSignup = async function(e) {
    e.preventDefault();
    var emailInput = document.getElementById('email');
    var ok = await saveSignup(emailInput ? emailInput.value : "", "footer-form");
    if (ok) {
      if (emailInput) emailInput.value = "";
      alert("Thanks — you're in.");
    }
  };

});
