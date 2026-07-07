import path from "node:path";
import { DATA_DIR, readJson, writeJson } from "./lib/io";
import { geocode } from "./lib/geocode";

type Area = { name: string; district: string; address?: string; latitude?: number; longitude?: number };
const file = path.join(DATA_DIR, "urban_areas.json");
const areas = await readJson<Area[]>(file);
for (const area of areas) {
  if (area.latitude && area.longitude) continue;
  Object.assign(area, await geocode(area.address ?? `서울특별시 ${area.district} ${area.name}`));
}
await writeJson(file, areas);
