/* Сборка компактного индекса улиц из сырого Overpass JSON */
import * as fs from 'fs';

const raw = JSON.parse(fs.readFileSync('public/regions/gelendzhik-raw.json', 'utf8'));
const streets = new Map();
for (const el of raw.elements || []) {
  if (el.type !== 'way' || !el.tags || !el.tags.name) continue;
  const name = String(el.tags.name).trim();
  if (!name || /^\d+$/.test(name)) continue;
  let lat, lng;
  if (el.center) {
    lat = el.center.lat;
    lng = el.center.lon;
  } else if (el.lat) {
    lat = el.lat;
    lng = el.lon;
  } else continue;
  if (!streets.has(name)) {
    streets.set(name, { name, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 });
  }
}
const list = [...streets.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
fs.writeFileSync('public/regions/gelendzhik-streets.json', JSON.stringify({ city: 'Геленджик', count: list.length, streets: list }, null, 0));
console.log('Streets:', list.length);
console.log(list.slice(0, 10).map((s) => s.name).join(', '));
