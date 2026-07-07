import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { ROOT } from "./lib/io";

const encodedForbidden = [
  "U2VhcmNoaW5nIHRoZSB3ZWI=",
  "U2VhcmNoZWQgdGhlIHdlYg==",
  "U2VhcmNoIHRoZSB3ZWI=",
  "6rO17IudIEphdmFTY3JpcHQ=",
  "7IOY7ZSMIFVSTA==",
  "c2l0ZTpkYXRhLnNlb3VsLmdvLmty",
  "c2l0ZTpkYXRhLmdvLmty",
  "c2l0ZTprb3Npcy5rcg==",
].map((value) => Buffer.from(value, "base64").toString("utf8"));

const roots = [path.join(ROOT, ".codex"), path.join(ROOT, ".agents"), path.join(ROOT, "data", "logs")];
if (process.env.WEB_SEARCH_LOG_PATHS) roots.push(...process.env.WEB_SEARCH_LOG_PATHS.split(path.delimiter).map((item) => path.resolve(ROOT, item)));
const files: string[] = [];
async function collect(target: string) {
  try {
    const info = await stat(target);
    if (info.isFile()) { files.push(target); return; }
    if (!info.isDirectory()) return;
    for (const name of await readdir(target)) await collect(path.join(target, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
for (const root of roots) await collect(root);
const matches: { file: string; token: string }[] = [];
for (const file of files) {
  const text = await readFile(file, "utf8").catch(() => "");
  for (const token of encodedForbidden) if (text.includes(token)) matches.push({ file: path.relative(ROOT, file), token });
}
if (matches.length) throw new Error(`금지 로그 ${matches.length}건: ${matches.map((item) => `${item.file}:${item.token}`).join(", ")}`);
console.log(`web-search log validation passed: files=${files.length}, matches=0`);
