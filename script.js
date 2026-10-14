const $ = id => document.getElementById(id);

const citySearch = $("citySearch");
const dropdownBtn = $("dropdownBtn");
const cityList = $("cityList");
const searchWrap = document.querySelector(".search-wrap");
const statusBox = $("status");
const weatherContent = $("weatherContent");

// Popular cities are suggestions only, not weather data.
const popularNames = [
  "Indore", "Mumbai", "Delhi", "Bengaluru", "Chennai",
  "Kolkata", "Hyderabad", "Pune", "Bhopal", "Jaipur",
  "Ahmedabad", "Lucknow", "Patna", "Nagpur", "Surat",
  "Kochi", "Chandigarh", "Varanasi", "Dehradun", "Srinagar",
  "Guwahati", "Ranchi", "Raipur", "Jodhpur", "Amritsar",
  "Mysuru", "Noida", "Gurugram", "Thiruvananthapuram",
  "Visakhapatnam", "Coimbatore", "Agra", "Kanpur", "Nashik",
  "Vadodara", "Udaipur", "Shimla", "Mangaluru", "Jabalpur"
];

const popularCities = popularNames.map(name => ({
  name,
  country: "India",
  country_code: "IN",
  admin1: ""
}));

let allIndianCities = [...popularCities];
let collectionLoaded = false;
let collectionPromise = null;
let searchTimer;
let searchId = 0;
let weatherId = 0;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function cityKey(city) {
  return [
    normalize(city.name),
    normalize(city.admin1),
    normalize(city.country_code)
  ].join("|");
}

function uniqueCities(cities) {
  const seen = new Set();

  return cities.filter(city => {
    const key = cityKey(city);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function showStatus(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", error);
  statusBox.hidden = false;
}

function hideStatus() {
  statusBox.hidden = true;
}

function openDropdown() {
  cityList.hidden = false;
  citySearch.setAttribute("aria-expanded", "true");
  dropdownBtn.setAttribute("aria-expanded", "true");
}

function closeDropdown() {
  cityList.hidden = true;
  citySearch.setAttribute("aria-expanded", "false");
  dropdownBtn.setAttribute("aria-expanded", "false");
}

function showEmpty(message) {
  cityList.replaceChildren();

  const item = document.createElement("div");
  item.className = "empty-results";
  item.textContent = message;

  cityList.appendChild(item);
  openDropdown();
}

function renderCities(cities, heading = "Indian cities") {
  cityList.replaceChildren();

  const title = document.createElement("div");
  title.className = "list-heading";
  title.textContent = heading;
  cityList.appendChild(title);

  if (!cities.length) {
    const empty = document.createElement("div");
    empty.className = "empty-results";
    empty.textContent =
      "No matching locations. Try another spelling.";
    cityList.appendChild(empty);
    openDropdown();
    return;
  }

  // Limit the visible list for performance.
  cities.slice(0, 100).forEach(city => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "city-option";
    button.setAttribute("role", "option");

    const pin = document.createElement("span");
    pin.className = "city-pin";
    pin.textContent = "📍";

    const info = document.createElement("span");
    const name = document.createElement("strong");
    const location = document.createElement("small");

    name.textContent = city.name;
    location.textContent = [
      city.admin1,
      city.country || "India"
    ].filter(Boolean).join(", ");

    info.append(name, location);
    button.append(pin, info);

    button.addEventListener("click", () => selectCity(city));
    cityList.appendChild(button);
  });

  openDropdown();
}

function localMatches(query) {
  const q = normalize(query);

  return allIndianCities.filter(city =>
    normalize(city.name).includes(q) ||
    normalize(city.admin1).includes(q)
  );
}

function sortCities(cities) {
  return uniqueCities(cities).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// Load a broader collection using alphabetic geocoding searches.
// This is not a guaranteed exhaustive national gazetteer.
async function loadCityCollection() {
  if (collectionLoaded) return allIndianCities;
  if (collectionPromise) return collectionPromise;

  collectionPromise = (async () => {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const found = [...popularCities];

    try {
      // Batch requests to avoid sending 26 requests simultaneously.
      for (let i = 0; i < letters.length; i += 4) {
        const batch = letters.slice(i, i + 4);

        const results = await Promise.all(batch.map(async letter => {
          const params = new URLSearchParams({
            name: letter,
            count: "100",
            language: "en",
            format: "json",
            countryCode: "IN"
          });

          const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?${params}`
          );

          if (!response.ok) return [];

          const data = await response.json();

          return (data.results || [])
            .filter(city => city.country_code === "IN")
            .map(city => ({
              name: city.name,
              country: city.country || "India",
              country_code: "IN",
              admin1: city.admin1 || "",
              latitude: city.latitude,
              longitude: city.longitude
            }));
        }));

        found.push(...results.flat());
      }

      allIndianCities = sortCities(found);
      collectionLoaded = true;

    } catch (error) {
      console.error("City collection loading failed:", error);
      allIndianCities = sortCities(found);
    }

    return allIndianCities;
  })();

  try {
    return await collectionPromise;
  } finally {
    collectionPromise = null;
  }
}

// Search the API directly when the local collection is insufficient.
async function searchCityAPI(query, requestId) {
  const params = new URLSearchParams({
    name: query,
    count: "100",
    language: "en",
    format: "json",
    countryCode: "IN"
  });

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`
  );

  if (!response.ok) {
    throw new Error("City search service is unavailable.");
  }

  const data = await response.json();

  if (requestId !== searchId) return;

  const results = (data.results || [])
    .filter(city => city.country_code === "IN")
    .map(city => ({
      name: city.name,
      country: city.country || "India",
      country_code: "IN",
      admin1: city.admin1 || "",
      latitude: city.latitude,
      longitude: city.longitude
    }));

  const merged = sortCities([...results, ...localMatches(query)]);

  renderCities(
    merged,
    `${merged.length} matching locations`
  );
}

async function searchCities(query) {
  const requestId = ++searchId;
  const matches = localMatches(query);

  if (!query) {
    renderCities(
      collectionLoaded ? allIndianCities : popularCities,
      collectionLoaded ? "Indian locations" : "Popular Indian cities"
    );
    return;
  }

  renderCities(matches, "Searching locations...");

  try {
    await searchCityAPI(query, requestId);
  } catch (error) {
    if (requestId !== searchId) return;

    renderCities(
      matches,
      matches.length
        ? "Local matches (search service unavailable)"
        : "Search service unavailable"
    );
  }
}

async function toggleDropdown() {
  if (!cityList.hidden) {
    closeDropdown();
    return;
  }

  openDropdown();

  if (!collectionLoaded) {
    showEmpty("Loading Indian location collection...");

    await loadCityCollection();
  }

  // Use the latest input in case it changed during loading.
  const query = citySearch.value.trim();

  if (query) {
    renderCities(
      localMatches(query),
      "Matching Indian locations"
    );
  } else {
    renderCities(allIndianCities, "Indian locations — A to Z");
  }
}

function selectCity(city) {
  citySearch.value = city.name;
  closeDropdown();
  loadWeather(city);
}

function weatherDescription(code) {
  const weather = {
    0: ["Clear sky", "☀️"],
    1: ["Mainly clear", "🌤️"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Foggy", "🌫️"],
    48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"],
    53: ["Moderate drizzle", "🌦️"],
    55: ["Dense drizzle", "🌧️"],
    56: ["Freezing drizzle", "🌧️"],
    57: ["Heavy freezing drizzle", "🌧️"],
    61: ["Slight rain", "🌦️"],
    63: ["Moderate rain", "🌧️"],
    65: ["Heavy rain", "🌧️"],
    66: ["Light freezing rain", "🌧️"],
    67: ["Heavy freezing rain", "🌧️"],
    71: ["Slight snowfall", "🌨️"],
    73: ["Moderate snowfall", "🌨️"],
    75: ["Heavy snowfall", "❄️"],
    77: ["Snow grains", "❄️"],
    80: ["Slight rain showers", "🌦️"],
    81: ["Moderate rain showers", "🌧️"],
    82: ["Violent rain showers", "⛈️"],
    85: ["Snow showers", "🌨️"],
    86: ["Heavy snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️"],
    99: ["Thunderstorm with heavy hail", "⛈️"]
  };

  return weather[code] || ["Weather conditions unavailable", "🌡️"];
}

function formatCityName(city) {
  return [...new Set([
    city.name,
    city.admin1,
    city.country || "India"
  ].filter(Boolean))].join(", ");
}

async function loadWeather(city) {
  const requestId = ++weatherId;

  weatherContent.hidden = true;
  showStatus(`Fetching live weather for ${city.name}...`);

  try {
    let latitude = city.latitude;
    let longitude = city.longitude;

    // Obtain coordinates if the selected suggestion has none.
    if (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude)) {
      const params = new URLSearchParams({
        name: city.name,
        count: "100",
        language: "en",
        format: "json",
        countryCode: "IN"
      });

      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?${params}`
      );

      if (!response.ok) {
        throw new Error("Could not look up city coordinates.");
      }

      const data = await response.json();

      const match = (data.results || []).find(result =>
        result.country_code === "IN" &&
        normalize(result.name) === normalize(city.name) &&
        (!city.admin1 || result.admin1 === city.admin1)
      );

      if (!match) {
        throw new Error("City coordinates could not be found.");
      }

      latitude = match.latitude;
      longitude = match.longitude;
    }

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m"
      ].join(","),
      timezone: "auto"
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
      throw new Error("Weather service could not return data.");
    }

    const data = await response.json();

    if (requestId !== weatherId) return;

    const current = data.current;

    if (
      !current ||
      !Number.isFinite(current.temperature_2m) ||
      !Number.isFinite(current.relative_humidity_2m) ||
      !Number.isFinite(current.apparent_temperature) ||
      !Number.isFinite(current.wind_speed_10m) ||
      !Number.isFinite(current.cloud_cover) ||
      !Number.isFinite(current.weather_code)
    ) {
      throw new Error("Weather data is incomplete.");
    }

    displayWeather(city, current, data.timezone);

  } catch (error) {
    if (requestId !== weatherId) return;

    weatherContent.hidden = true;
    showStatus(
      `${error.message || "Something went wrong."} Check your connection and try again.`,
      true
    );
  }
}

function displayWeather(city, current, timezone) {
  const [description, icon] =
    weatherDescription(current.weather_code);

  $("cityName").textContent = formatCityName(city);
  $("condition").textContent = description;
  $("weatherIcon").textContent = icon;

  $("temperature").textContent =
    Math.round(current.temperature_2m);

  $("humidity").textContent = current.relative_humidity_2m;

  $("windSpeed").textContent =
    Number(current.wind_speed_10m).toFixed(1);

  $("feelsDetail").textContent =
    Math.round(current.apparent_temperature);

  $("feelsLike").textContent =
    `Feels like ${Math.round(current.apparent_temperature)}°C`;

  $("cloudCover").textContent = current.cloud_cover;

  $("daySummary").textContent = current.is_day === 1
    ? "Daytime weather conditions"
    : "Nighttime weather conditions";

  $("currentDate").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone || "Asia/Kolkata"
  }).format(new Date(current.time));

  $("lastUpdated").textContent =
    `Observation time: ${current.time.replace("T", " ")} (${timezone || "local time"})`;

  hideStatus();
  weatherContent.hidden = false;
}

// Search as the user types.
citySearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchId++;

  const query = citySearch.value.trim();

  if (!query) {
    renderCities(
      collectionLoaded ? allIndianCities : popularCities,
      collectionLoaded ? "Indian locations — A to Z" : "Popular Indian cities"
    );
    return;
  }

  const matches = localMatches(query);
  renderCities(matches, "Matching locations");

  searchTimer = setTimeout(() => {
    searchCities(query);
  }, 350);
});

dropdownBtn.addEventListener("click", toggleDropdown);

citySearch.addEventListener("focus", () => {
  if (cityList.hidden) {
    if (citySearch.value.trim()) {
      searchCities(citySearch.value.trim());
    } else {
      renderCities(
        collectionLoaded ? allIndianCities : popularCities,
        collectionLoaded ? "Indian locations — A to Z" : "Popular Indian cities"
      );
    }
  }
});

citySearch.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDropdown();
  }

  if (event.key === "ArrowDown" && cityList.hidden) {
    toggleDropdown();
  }

  if (event.key === "Enter") {
    event.preventDefault();

    const first = cityList.querySelector(".city-option");

    if (first && !cityList.hidden) {
      first.click();
    } else if (citySearch.value.trim()) {
      searchCities(citySearch.value.trim());
    }
  }
});

document.addEventListener("click", event => {
  if (!searchWrap.contains(event.target)) {
    closeDropdown();
  }
});

// Initial live weather.
showStatus("Search for a city or select one from the dropdown.");
