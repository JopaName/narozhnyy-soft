/* Сборка компактных индексов улиц из сырых Overpass JSON */
import * as fs from 'fs';

const CITIES = [
  { file: 'public/regions/gelendzhik-raw.json', out: 'public/regions/gelendzhik-streets.json', city: 'Геленджик' },
  { file: 'public/regions/krasnodar-raw.json', out: 'public/regions/krasnodar-streets.json', city: 'Краснодар' },
  { file: 'public/regions/rostov-raw.json', out: 'public/regions/rostov-streets.json', city: 'Ростов-на-Дону' },
];

for (const c of CITIES) {
  if (!fs.existsSync(c.file)) {
    console.log('SKIP (нет сырых данных):', c.city);
    continue;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(c.file, 'utf8'));
  } catch {
    console.log('SKIP (битый JSON):', c.city);
    continue;
  }
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
  fs.writeFileSync(c.out, JSON.stringify({ city: c.city, count: list.length, streets: list }));
  console.log(c.city + ':', list.length, 'улиц');
}
