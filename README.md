# SkyCast - Weather Dashboard

SkyCast is a responsive weather dashboard that displays real-time
weather conditions for Indian locations.

## Features

- Searchable city dropdown.
- Alphabetically sorted collection of retrieved locations.
- Dynamic city search using geocoding.
- Live temperature and weather conditions.
- Humidity and wind speed.
- Feels-like temperature and cloud cover.
- Weather icons based on weather codes.
- Loading indicators and API error handling.
- Responsive desktop and mobile interface.
- Keyboard support for search and dropdown.

## Technologies

- HTML5
- CSS3
- JavaScript
- Open-Meteo Geocoding API
- Open-Meteo Forecast API

## Project Structure

weather-dashboard/
├── index.html
├── style.css
├── script.js
└── README.md

## Setup

1. Open the project folder in Visual Studio Code.
2. Install the Live Server extension.
3. Right-click index.html.
4. Select Open with Live Server.
5. Search for an Indian city or open the dropdown.
6. Select a location to fetch current weather.

An internet connection is required.

## APIs

Geocoding:
https://open-meteo.com/en/docs/geocoding-api

Forecast:
https://open-meteo.com/en/docs

The geocoding API supplies city names and coordinates.
The forecast API supplies current weather observations.

## Error Handling

- Shows loading status while fetching data.
- Handles network and API failures.
- Handles unavailable city coordinates.
- Checks whether the weather response contains required values.
- Ignores outdated weather responses when cities change quickly.

## Data Accuracy

Weather values are fetched from the API rather than hardcoded.
The browsable city collection is assembled from geocoding results
and is not guaranteed to contain every Indian city or village.

## Credits

Open-Meteo: https://open-meteo.com/