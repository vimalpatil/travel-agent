import { tool } from "langchain";
import { z } from "zod";

function summarize(city, data) {
  const cur = data.current_condition?.[0];
  if (!cur) return `No weather data available for ${city}.`;

  const area = data.nearest_area?.[0];
  const location = area
    ? [area.areaName?.[0]?.value, area.region?.[0]?.value, area.country?.[0]?.value]
        .filter(Boolean)
        .join(", ")
    : city;

  const lines = [
    `Weather for ${location}:`,
    `Now: ${cur.weatherDesc?.[0]?.value ?? "Unknown"}, ${cur.temp_C}°C (${cur.temp_F}°F), ` +
      `feels like ${cur.FeelsLikeC}°C (${cur.FeelsLikeF}°F), humidity ${cur.humidity}%, ` +
      `wind ${cur.windspeedKmph} km/h ${cur.winddir16Point}.`,
    "Forecast:",
  ];

  for (const day of data.weather ?? []) {
    const midday = day.hourly?.[4] ?? day.hourly?.[0];
    lines.push(
      `- ${day.date}: ${day.mintempC}–${day.maxtempC}°C (${day.mintempF}–${day.maxtempF}°F), ` +
        `${midday?.weatherDesc?.[0]?.value?.trim() ?? "n/a"}, chance of rain ${midday?.chanceofrain ?? "?"}%`
    );
  }
  return lines.join("\n");
}

export const weatherLookup = tool(
  async ({ city }) => {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
        headers: { "User-Agent": "travel-agent/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return `Could not get weather for "${city}" (HTTP ${res.status}).`;
      return summarize(city, await res.json());
    } catch (err) {
      return `Could not get weather for "${city}": ${err.message}`;
    }
  },
  {
    name: "weather_lookup",
    description:
      "Get the current weather and a 3-day forecast for a city. Use whenever the user asks about weather, " +
      "temperature or what to pack for a specific place.",
    schema: z.object({
      city: z.string().describe("City name, optionally with country, e.g. 'Paris' or 'Portland, Oregon'"),
    }),
  }
);
