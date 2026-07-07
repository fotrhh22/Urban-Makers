import path from "node:path";
import { DATA_DIR, readJson, writeJson } from "./lib/io";
import { geocode } from "./lib/geocode";

type Facility = { name: string; address?: string; latitude?: number; longitude?: number };
const file = path.join(DATA_DIR, "anchor_facilities.json");
const facilities = await readJson<Facility[]>(file);
for (const facility of facilities) {
  if (facility.latitude && facility.longitude) continue;
  Object.assign(facility, await geocode(facility.address ?? `서울특별시 ${facility.name}`));
}
await writeJson(file, facilities);
