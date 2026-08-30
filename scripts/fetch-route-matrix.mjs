import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cities = [
  ["Birmingham", 52.4862, -1.8904],
  ["London", 51.5074, -0.1278],
  ["Manchester", 53.4808, -2.2426],
  ["Leeds", 53.8008, -1.5491],
  ["Glasgow", 55.8642, -4.2518],
  ["Bristol", 51.4545, -2.5879],
  ["Coventry", 52.4068, -1.5197],
  ["Nottingham", 52.9548, -1.1581],
  ["Wolverhampton", 52.5862, -2.1288],
  ["Solihull", 52.4118, -1.7776],
  ["Walsall", 52.5862, -1.9823],
  ["Edinburgh", 55.9533, -3.1883],
  ["Liverpool", 53.4084, -2.9916],
  ["Sheffield", 53.3811, -1.4701],
  ["Newcastle", 54.9783, -1.6178],
  ["Cardiff", 51.4816, -3.1791],
  ["Leicester", 52.6369, -1.1398],
  ["Southampton", 50.9097, -1.4044],
  ["Plymouth", 50.3755, -4.1427],
  ["Hull", 53.7678, -0.3272],
  ["Derby", 52.9225, -1.4746],
  ["Stoke", 53.0027, -2.1794],
  ["Reading", 51.4543, -0.9781],
  ["Oxford", 51.752, -1.2577],
  ["Cambridge", 52.2053, 0.1218],
  ["Norwich", 52.6309, 1.2974],
  ["Exeter", 50.7184, -3.5339],
  ["York", 53.96, -1.0873],
  ["Preston", 53.7632, -2.7031],
  ["Milton Keynes", 52.0406, -0.7594],
  ["Northampton", 52.2405, -0.9027],
  ["Peterborough", 52.5695, -0.2405],
  ["Swindon", 51.5558, -1.7797],
  ["Ipswich", 52.0567, 1.1482],
  ["Aberdeen", 57.1497, -2.0943],
];

const coords = cities.map(([, lat, lng]) => `${lng},${lat}`).join(";");
const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance,duration`;
const res = await fetch(url, { headers: { "User-Agent": "TruckersCompare/1.0" } });
if (!res.ok) {
  throw new Error(`OSRM table failed: ${res.status} ${await res.text()}`);
}
const data = await res.json();
if (data.code !== "Ok") {
  throw new Error(`OSRM table code ${data.code}`);
}

const metersToMiles = (m) => Math.round((m / 1609.344) * 10) / 10;
const secToMin = (s) => Math.round(s / 60);
const miles = {};
const minutes = {};
for (let i = 0; i < cities.length; i++) {
  for (let j = 0; j < cities.length; j++) {
    const key = `${cities[i][0]}|${cities[j][0]}`;
    miles[key] = i === j ? 4 : metersToMiles(data.distances[i][j]);
    minutes[key] = i === j ? 12 : Math.max(8, secToMin(data.durations[i][j]));
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "route-matrix.json");
writeFileSync(out, JSON.stringify({ source: "osrm", fetchedAt: new Date().toISOString(), miles, minutes }));
console.log(`Wrote ${Object.keys(miles).length} pairs to ${out}`);
console.log(`Manchester→Birmingham ${miles["Manchester|Birmingham"]} mi / ${minutes["Manchester|Birmingham"]} min`);
