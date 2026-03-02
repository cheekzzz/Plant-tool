const totalSteps = 8;
let currentStep = 1;
let plantDatabase = [];
let lastTopPlants = [];
let lastAnswers = {};

const quizForm = document.getElementById("quizForm");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const stepIndicator = document.getElementById("stepIndicator");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const progressBar = document.getElementById("progressBar");
const validationMessage = document.getElementById("validationMessage");
const resultsSection = document.getElementById("resultsSection");
const loadingScreen = document.getElementById("loadingScreen");
const bestMatch = document.getElementById("bestMatch");
const startGrowingCard = document.getElementById("startGrowingCard");
const alternativesGrid = document.getElementById("alternativesGrid");
const carePanel = document.getElementById("carePanel");
const restartBtn = document.getElementById("restartBtn");
const soilMixBtn = document.getElementById("soilMixBtn");
const downloadPlanBtn = document.getElementById("downloadPlanBtn");
const emailForm = document.getElementById("emailForm");
const emailStatus = document.getElementById("emailStatus");
const emailSubmitBtn = document.getElementById("emailSubmitBtn");
const stepDots = document.getElementById("stepDots");
const stepFeedback = document.getElementById("stepFeedback");

soilMixBtn.disabled = true;
downloadPlanBtn.disabled = true;

const fieldOrder = ["location", "type", "sunlight", "water", "space", "difficulty", "purpose", "petSafe"];
const labels = {
  location: "location",
  type: "placement",
  sunlight: "sunlight",
  water: "watering",
  space: "space",
  difficulty: "experience",
  purpose: "purpose",
  petSafe: "pet safety",
};

const microFeedbackByStep = {
  1: "Great start! We'll align choices with your climate.",
  2: "Nice! We'll tailor plants to your placement.",
  3: "Perfect — matching light needs is key to healthy growth.",
  4: "Great! We'll balance recommendations with your watering rhythm.",
  5: "Awesome! We'll suggest plants that fit your available space.",
  6: "Great! We'll tune recommendations to your experience level.",
  7: "Love it! We'll prioritize plants that match your purpose.",
  8: "Final step — let's make sure your recommendation is pet friendly.",
};

function renderStepDots() {
  stepDots.innerHTML = Array.from({ length: totalSteps }, (_, index) => {
    const isActive = index + 1 <= currentStep ? "active" : "";
    return `<span class="step-dot ${isActive}"></span>`;
  }).join("");
}

async function loadPlants() {
  const response = await fetch("plants.json");
  plantDatabase = await response.json();
}

function showSuccessMessage() {
  emailForm.innerHTML = `
    <p style="color:green; font-weight:600;">
      Your plant care plan is on its way 🌱
    </p>
  `;
}

function updateStepUI() {
  document.querySelectorAll(".step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentStep);
  });

  const percent = Math.round((currentStep / totalSteps) * 100);
  stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", String(percent));
  renderStepDots();

  prevBtn.disabled = currentStep === 1;
  nextBtn.textContent = currentStep === totalSteps ? "See Results" : "Next";
  validationMessage.textContent = "";
  stepFeedback.textContent = microFeedbackByStep[currentStep];
}

function validateCurrentStep() {
  const fieldName = fieldOrder[currentStep - 1];
  const checked = quizForm.querySelector(`input[name="${fieldName}"]:checked`);
  if (!checked) {
    validationMessage.textContent = "Select an option to continue your recommendation.";
    return false;
  }
  return true;
}

function getMatchMeta(score) {
  const maxScore = 15;
  const confidence = Math.round((score / maxScore) * 100);

  if (confidence >= 90) return { confidence, matchLabel: "Excellent match" };
  if (confidence >= 70) return { confidence, matchLabel: "Strong match" };
  if (confidence >= 50) return { confidence, matchLabel: "Good match" };
  return { confidence, matchLabel: "Partial match" };
}

function getTopReasonTag(plant) {
  if (plant.difficulty === "beginner") return "Ideal for beginners";
  if (plant.sunlight === "high" && plant.space !== "small") return "Great for sunny balconies";
  if (plant.water === "low") return "Best for low maintenance homes";
  if (plant.purpose === "air-purifying") return "Great for fresher indoor air";
  if (plant.purpose === "flowering") return "Great for colorful flowering spaces";
  if (plant.purpose === "edible") return "Best for home-grown kitchen use";
  return "Balanced choice for everyday homes";
}

function getHumanFactorLabel(factor) {
  if (factor === "location") return "location";
  if (factor === "type") return "placement";
  if (factor === "sunlight") return "sunlight conditions";
  if (factor === "water") return "watering preference";
  if (factor === "space") return "available space";
  if (factor === "difficulty") return "experience level";
  if (factor === "purpose") return "plant goal";
  return "pet safety preference";
}

function getMismatchMessage(attribute, answers, plant) {
  if (attribute === "sunlight") return `Needs ${plant.sunlight} sunlight instead of ${answers.sunlight}.`;
  if (attribute === "water") return `Requires ${plant.water} watering instead of ${answers.water}.`;
  if (attribute === "type") return `Better suited for ${plant.type} placement.`;
  if (attribute === "space") return `Fits best in ${plant.space} spaces.`;
  if (attribute === "difficulty") return `Better for ${plant.difficulty} growers.`;
  if (attribute === "purpose") return `More aligned with ${plant.purpose} goals.`;
  if (attribute === "location") return "May need extra care in your local climate.";
  return "May not fully meet your pet-safety preference.";
}

function buildMatchNarrative(plant) {
  const factorLabels = plant.matchedAttributes.map(getHumanFactorLabel);

  if (!factorLabels.length) {
    return "This plant is a partial fit and may still work with a few adjustments.";
  }

  if (factorLabels.length === 1) {
    return `This plant fits well with your ${factorLabels[0]}.`;
  }

  const lastFactor = factorLabels[factorLabels.length - 1];
  const leadingFactors = factorLabels.slice(0, -1).join(", ");
  return `This plant fits well with your ${leadingFactors}, and ${lastFactor}.`;
}

function calculateTopPlants(answers) {
  const scoredPlants = plantDatabase.map((plant) => {
    let score = 0;
    const matchedAttributes = [];
    const mismatchMessages = [];

    const climates = Array.isArray(plant.climate) && plant.climate.length
      ? plant.climate
      : ["tropical", "temperate", "arid", "cold"];

    if (climates.includes(answers.location)) {
      score += 3;
      matchedAttributes.push("location");
    } else {
      mismatchMessages.push(getMismatchMessage("location", answers, plant));
    }

    if (plant.type === answers.type) {
      score += 2;
      matchedAttributes.push("type");
    } else {
      mismatchMessages.push(getMismatchMessage("type", answers, plant));
    }

    if (plant.sunlight === answers.sunlight) {
      score += 2;
      matchedAttributes.push("sunlight");
    } else {
      mismatchMessages.push(getMismatchMessage("sunlight", answers, plant));
    }

    if (plant.water === answers.water) {
      score += 2;
      matchedAttributes.push("water");
    } else {
      mismatchMessages.push(getMismatchMessage("water", answers, plant));
    }

    if (plant.space === answers.space) {
      score += 1;
      matchedAttributes.push("space");
    } else {
      mismatchMessages.push(getMismatchMessage("space", answers, plant));
    }

    if (plant.difficulty === answers.difficulty) {
      score += 1;
      matchedAttributes.push("difficulty");
    } else {
      mismatchMessages.push(getMismatchMessage("difficulty", answers, plant));
    }

    if (plant.purpose === answers.purpose) {
      score += 2;
      matchedAttributes.push("purpose");
    } else {
      mismatchMessages.push(getMismatchMessage("purpose", answers, plant));
    }

    if (answers.petSafe === "yes") {
      if (plant.petSafe === "yes") {
        score += 2;
        matchedAttributes.push("petSafe");
      } else {
        mismatchMessages.push(getMismatchMessage("petSafe", answers, plant));
      }
    }

    const { confidence, matchLabel } = getMatchMeta(score);
    const topReasonTag = getTopReasonTag(plant);
    const explanationText = buildMatchNarrative({ matchedAttributes });

    return { ...plant, score, confidence, matchLabel, matchedAttributes, mismatchMessages, topReasonTag, explanationText };
  });

  const sortedPlants = scoredPlants.sort((a, b) => b.score - a.score);
  const topPlants = sortedPlants.slice(0, 3);
  const hasStrongMatches = topPlants.some((plant) => plant.confidence > 60);

  return {
    topPlants,
    fallbackMessage: hasStrongMatches ? "" : "These are the closest matches based on your preferences.",
  };
}

function renderBestMatch(plant, fallbackMessage) {
  const matchSummary = plant.matchedAttributes.length
    ? plant.matchedAttributes.map((key) => labels[key]).join(", ")
    : "general suitability";

  bestMatch.innerHTML = `
    <span class="rank">Best Match</span>
    <h3>${plant.name}</h3>
    <span class="score-pill">Match Score: ${plant.confidence}%</span>
    <p class="best-match-copy">${plant.explanationText}</p>
    <p><strong>${plant.topReasonTag}</strong></p>
    <p><strong>Match Breakdown:</strong> ${plant.matchedAttributes.length} out of 8 factors matched</p>
    <p><strong>Match Label:</strong> ${plant.matchLabel}</p>
    ${fallbackMessage ? `<p>${fallbackMessage}</p>` : ""}
    <p><strong>Why it matches your space:</strong> Matches your ${matchSummary}.</p>
    ${plant.mismatchMessages.length ? `<h4>Things to consider:</h4><ul>${plant.mismatchMessages.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
    <h4>Why this fits you</h4>
    <ul>${plant.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
    <h4>Care instructions</h4>
    <p>${plant.care}</p>
    <button type="button" class="btn btn-primary best-match-cta" id="emailCtaBtn">Email this recommendation</button>
  `;

  const emailCtaBtn = document.getElementById("emailCtaBtn");
  emailCtaBtn?.addEventListener("click", () => {
    document.getElementById("emailInput")?.focus();
    document.getElementById("emailInput")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderAlternatives(plants) {
  alternativesGrid.innerHTML = plants
    .map(
      (plant, index) => `
      <article class="result-card">
        <span class="rank">#${index + 2} Alternative</span>
        <h3>${plant.name}</h3>
        <span class="score-pill">Match Score: ${plant.confidence}%</span>
        <p><strong>${plant.matchLabel}</strong></p>
        <p><strong>${plant.topReasonTag}</strong></p>
        <p><strong>Match Breakdown:</strong> ${plant.matchedAttributes.length} out of 8 factors matched</p>
        <p><strong>Why it matches your space:</strong> Matches your ${plant.matchedAttributes.map((key) => labels[key]).join(", ") || "core preferences"}.</p>
        ${plant.mismatchMessages.length ? `<p><strong>Things to consider:</strong> ${plant.mismatchMessages.slice(0, 2).join(" ")}</p>` : ""}
        <p>${plant.reasons[0]}</p>
      </article>`
    )
    .join("");
}

function renderCarePanel(topPlants) {
  const tips = topPlants.map((plant) => `<li><strong>${plant.name}:</strong> ${plant.care}</li>`).join("");
  carePanel.innerHTML = `<h3 class="section-title">Care Tips Snapshot</h3><ul>${tips}</ul>`;
}

function getPotSize(space, type) {
  if (space === "small") return type === "outdoor" ? "8-10 inch terracotta pot" : "6-8 inch indoor pot";
  if (space === "medium") return type === "outdoor" ? "12-14 inch planter" : "10-12 inch indoor planter";
  return type === "outdoor" ? "18+ inch grow container / garden bed" : "14-16 inch floor planter";
}

function getWateringSchedule(waterLevel) {
  if (waterLevel === "low") return "Water deeply every 10-14 days. Let top soil dry between watering.";
  if (waterLevel === "medium") return "Water about once a week. Keep soil lightly moist, not soggy.";
  return "Water every 2-3 days and check topsoil moisture frequently.";
}

function getSunlightPlacement(sunlightLevel, plantType) {
  if (sunlightLevel === "low") return plantType === "indoor" ? "Near a bright room corner with indirect light." : "Outdoor partial shade (no harsh afternoon sun).";
  if (sunlightLevel === "medium") return plantType === "indoor" ? "Place near an east-facing window or filtered balcony light." : "Morning sun + filtered afternoon light.";
  return plantType === "indoor" ? "Closest bright window with a few hours of direct sun." : "Open sunny area with 5-6+ hours of direct sunlight.";
}

function renderStartGrowing(plant, answers) {
  const potSize = getPotSize(answers.space, plant.type);
  const watering = getWateringSchedule(plant.water);
  const sunlight = getSunlightPlacement(plant.sunlight, plant.type);

  startGrowingCard.innerHTML = `
    <h3>Start Growing Your Plant</h3>
    <div class="start-growing-grid">
      <article class="grow-tip">
        <div class="label">Recommended pot size</div>
        <p>${potSize}</p>
      </article>
      <article class="grow-tip">
        <div class="label">Watering schedule</div>
        <p>${watering}</p>
      </article>
      <article class="grow-tip">
        <div class="label">Sunlight placement</div>
        <p>${sunlight}</p>
      </article>
    </div>
  `;
}

function renderResults(topPlants, answers, fallbackMessage) {
  const [winner, ...alternatives] = topPlants;
  renderBestMatch(winner, fallbackMessage);
  renderAlternatives(alternatives);
  renderStartGrowing(winner, answers);
  renderCarePanel(topPlants);
  lastTopPlants = topPlants;
  lastAnswers = answers;

  soilMixBtn.dataset.plantName = winner.name;
  soilMixBtn.dataset.plantType = winner.type;
  soilMixBtn.disabled = false;
  downloadPlanBtn.disabled = false;
  emailSubmitBtn.disabled = false;
  emailStatus.textContent = "";

  loadingScreen.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openSoilMixCalculator() {
  window.location.href = "https://earthlyours.com/soilmix-calculator/";
}


function downloadCarePlan() {
  if (!lastTopPlants.length) {
    emailStatus.textContent = "Generate your plant recommendation first";
    return;
  }

  const [bestMatch, ...alternatives] = lastTopPlants;
  const bestReasons = bestMatch.reasons.map((reason) => `- ${reason}`).join("\n");
  const alternativesText = alternatives.length
    ? alternatives
        .map(
          (plant, index) =>
            `${index + 1}. ${plant.name}\n   - Match Score: ${plant.confidence}%\n   - Care: ${plant.care}`
        )
        .join("\n")
    : "None";

  const content = [
    "Plant Care Plan",
    "",
    "Best Match:",
    bestMatch.name,
    "",
    "Match Score:",
    `${bestMatch.confidence}% (${bestMatch.matchLabel})`,
    "",
    "Care Instructions:",
    bestMatch.care,
    "",
    "Why This Fits You:",
    bestReasons,
    "",
    "Alternatives:",
    alternativesText,
    "",
    "Tips:",
    `- Recommended pot size: ${getPotSize(lastAnswers.space, bestMatch.type)}`,
    `- Watering schedule: ${getWateringSchedule(bestMatch.water)}`,
    `- Sunlight placement: ${getSunlightPlacement(bestMatch.sunlight, bestMatch.type)}`,
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plant-care-plan.txt";
  a.click();
  URL.revokeObjectURL(url);
}
function populateUserData() {
  const bestPlant = lastTopPlants[0];   //

  if (!bestPlant) {
    console.log("No plant data");
    return;
  }

  console.log("Best plant:", bestPlant);

  document.getElementById("plantField").value = bestPlant.name || "";
  document.getElementById("plantNameField").value = bestPlant.name || "";
  document.getElementById("scoreField").value = String(bestPlant.confidence || "");
  document.getElementById("locationField").value = lastAnswers.location || "";
}
function submitEmailCapture(event) {

  console.log("Top plants:", lastTopPlants);

  if (!lastTopPlants.length) {
    event.preventDefault();
    emailStatus.textContent = "Generate your plant recommendation first";
    return;
  }

  const emailInput = document.getElementById("emailInput");
  const email = emailInput.value.trim();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    event.preventDefault();
    emailStatus.textContent = "Please enter a valid email address.";
    emailInput.focus();
    return;
  }

  // Fill hidden fields
  populateUserData();

  emailSubmitBtn.disabled = true;
  emailStatus.textContent = "Sending your plant plan...";
}



quizForm.addEventListener("change", (event) => {
  if (event.target.matches('input[type="radio"]')) {
    stepFeedback.textContent = microFeedbackByStep[currentStep];
  }
});

nextBtn.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  if (currentStep < totalSteps) {
    currentStep += 1;
    updateStepUI();
    return;
  }

  const answers = Object.fromEntries(new FormData(quizForm).entries());
  const { topPlants, fallbackMessage } = calculateTopPlants(answers);

  resultsSection.classList.add("hidden");
  loadingScreen.classList.remove("hidden");
  loadingScreen.scrollIntoView({ behavior: "smooth", block: "start" });

  setTimeout(() => {
    renderResults(topPlants, answers, fallbackMessage);
  }, 1500);
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep -= 1;
    updateStepUI();
  }
});

restartBtn.addEventListener("click", () => {
  quizForm.reset();
  emailForm.reset();
  currentStep = 1;
  lastTopPlants = [];
  lastAnswers = {};
  soilMixBtn.dataset.plantName = "";
  soilMixBtn.dataset.plantType = "";
  soilMixBtn.disabled = true;
  downloadPlanBtn.disabled = true;
  emailSubmitBtn.disabled = true;
  emailStatus.textContent = "";
  startGrowingCard.innerHTML = "";
  resultsSection.classList.add("hidden");
  loadingScreen.classList.add("hidden");
  updateStepUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

soilMixBtn.addEventListener("click", openSoilMixCalculator);
downloadPlanBtn.addEventListener("click", downloadCarePlan);
emailForm.addEventListener("submit", submitEmailCapture);

loadPlants().then(updateStepUI).catch(() => {
  validationMessage.textContent = "Unable to load plant database. Refresh and try again.";
  nextBtn.disabled = true;
});
