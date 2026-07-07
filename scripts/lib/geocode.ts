import { fetchJson, requireEnv } from "./io";

type KakaoResponse = { documents: { x: string; y: string }[] };

export async function geocode(query: string) {
  const key = requireEnv("KAKAO_REST_API_KEY");
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  const data = await fetchJson<KakaoResponse>(url, { headers: { Authorization: `KakaoAK ${key}` } });
  const match = data.documents[0];
  if (!match) throw new Error(`No geocoding result: ${query}`);
  return { latitude: Number(match.y), longitude: Number(match.x) };
}
