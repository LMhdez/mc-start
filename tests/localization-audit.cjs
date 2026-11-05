"use strict";

const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("script.js", "utf8");

function extractLocale(name) {
  const marker = new RegExp("^\\s{2}" + name + ":\\s*\\{", "m");
  const match = marker.exec(source);
  if (!match) throw new Error("Missing locale: " + name);

  const open = source.indexOf("{", match.index);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "\`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error("Unclosed locale object: " + name);
}

function localeKeys(block, name) {
  const keys = [...block.matchAll(/(?:^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/gm)]
    .map(match => match[1]);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length) {
    throw new Error(name + " has duplicate keys: " + [...new Set(duplicates)].join(", "));
  }
  return keys;
}

const names = ["pt", "es", "en"];
const blocks = Object.fromEntries(names.map(name => [name, extractLocale(name)]));
const keys = Object.fromEntries(names.map(name => [name, localeKeys(blocks[name], name)]));
const reference = new Set(keys.pt);

for (const name of names.slice(1)) {
  const current = new Set(keys[name]);
  const missing = [...reference].filter(key => !current.has(key));
  const extra = [...current].filter(key => !reference.has(key));
  if (missing.length || extra.length) {
    throw new Error(name + " locale key mismatch; missing: " +
      missing.join(", ") + "; extra: " + extra.join(", "));
  }
}

const locales = Object.fromEntries(names.map(name => [
  name,
  vm.runInNewContext("(" + blocks[name] + ")")
]));

for (const name of names) {
  for (const [key, value] of Object.entries(locales[name])) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(name + "." + key + " is not a non-empty translation");
    }
  }
}

if (/\bVM\b/i.test(locales.es.addressUnavailable)) {
  throw new Error("Spanish address-unavailable text must use player-facing language");
}

console.log("Translations verified: " + keys.pt.length +
  " matching keys in PT, ES and EN; no duplicates or empty values.");
