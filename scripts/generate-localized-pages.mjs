import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ORIGIN = "https://lmhdez.github.io";
const SITE_PATH = "/mc-start/";
const locales = {
  pt: { dir: "", lang: "pt-PT", locale: "pt_PT", title: "MC Server — O teu mundo. As tuas regras.", desc: "Consulta se o servidor está online, vê quem está a jogar e encontra os dados para te ligares.", og: "Vê se o servidor está online, descobre quem está a jogar e junta-te à aventura.", image: "social-preview.png", alt: "MC Server — O teu mundo. As tuas regras. Junta-te à aventura.", doc: "Minecraft Server | O teu servidor" },
  en: { dir: "en", lang: "en", locale: "en_GB", title: "MC Server — Your world. Your rules.", desc: "Check whether the server is online, see who is playing and find the details to join.", og: "Check whether the server is online, see who is playing and join the adventure.", image: "social-preview-en.png", alt: "MC Server — Your world. Your rules. Join the adventure.", doc: "Minecraft Server | Your server" },
  es: { dir: "es", lang: "es", locale: "es_ES", title: "MC Server — Tu mundo. Tus reglas.", desc: "Comprueba si el servidor está en línea, quién está jugando y cómo conectarte.", og: "Comprueba si el servidor está en línea, descubre quién está jugando y únete a la aventura.", image: "social-preview-es.png", alt: "MC Server — Tu mundo. Tus reglas. Únete a la aventura.", doc: "Minecraft Server | Tu servidor" }
};

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
function escapeText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function matchingBrace(source, openIndex) {
  let depth = 0, quote = null, escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "\`") quote = char;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return i;
  }
  throw new Error("Unclosed translation dictionary");
}

function readTranslations() {
  const source = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
  const dictionaries = {};
  for (const locale of ["pt", "en", "es"]) {
    const marker = "  " + locale + ": {";
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) throw new Error("Missing translation locale: " + locale);
    const openIndex = source.indexOf("{", markerIndex);
    const closeIndex = matchingBrace(source, openIndex);
    const block = source.slice(openIndex + 1, closeIndex);
    const dictionary = {};
    const property = /(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:\s*("(?:\\.|[^"\\])*")/g;
    for (const match of block.matchAll(property)) {
      if (Object.hasOwn(dictionary, match[1])) {
        throw new Error("Duplicate " + locale + " translation: " + match[1]);
      }
      dictionary[match[1]] = JSON.parse(match[2]);
    }
    dictionaries[locale] = dictionary;
  }
  const referenceKeys = Object.keys(dictionaries.pt).sort().join("|");
  for (const locale of ["en", "es"]) {
    if (Object.keys(dictionaries[locale]).sort().join("|") !== referenceKeys) {
      throw new Error("Translation keys do not match for locale: " + locale);
    }
  }
  return dictionaries;
}

function localizeStaticLine(line, dictionary) {
  line = line.replace(
    /(<[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/[^>]+>)/,
    (whole, opening, key, previous, closing) => {
      if (!Object.hasOwn(dictionary, key)) throw new Error("Missing translation: " + key);
      return opening + escapeText(dictionary[key]) + closing;
    }
  );
  line = line.replace(
    /(aria-label=")[^"]*("(?=[^>]*data-i18n-aria="([^"]+)"))/,
    (whole, opening, closing, key) => {
      if (!Object.hasOwn(dictionary, key)) throw new Error("Missing aria translation: " + key);
      return opening + escapeAttribute(dictionary[key]) + closing;
    }
  );
  line = line.replace(
    /(placeholder=")[^"]*("(?=[^>]*data-i18n-placeholder="([^"]+)"))/,
    (whole, opening, closing, key) => {
      if (!Object.hasOwn(dictionary, key)) throw new Error("Missing placeholder translation: " + key);
      return opening + escapeAttribute(dictionary[key]) + closing;
    }
  );
  return line;
}
function updateMeta(lines, kind, key, value) {
  const attribute = kind === "name" ? "name" : "property";
  const marker = '<meta ' + attribute + '="' + key + '"';
  const tag = '  <meta ' + attribute + '="' + key + '" content="' + escapeAttribute(value) + '">';
  const index = lines.findIndex(line => line.trim().startsWith(marker));
  if (index >= 0) lines[index] = tag;
  else lines.splice(lines.indexOf("</head>"), 0, tag);
}
function replaceHref(line, value) {
  const start = line.indexOf('href="');
  if (start < 0) return line;
  const end = line.indexOf('"', start + 6);
  return line.slice(0, start) + 'href="' + value + '"' + line.slice(end + 1);
}
function render(template, code, config, dictionary) {
  const pagePath = SITE_PATH + (config.dir ? config.dir + "/" : "");
  const pageUrl = ORIGIN + pagePath;
  const imageUrl = ORIGIN + SITE_PATH + config.image;
  let lines = template.split(/\r?\n/);
  lines = lines.map(line => {
    if (line.startsWith("<html lang=")) return '<html lang="' + config.lang + '">';
    if (line.trim().startsWith("<title>")) return "  <title>" + escapeText(config.doc) + "</title>";
    return localizeStaticLine(line, dictionary);
  });

  const tags = [
    ["name", "description", config.desc],
    ["property", "og:locale", config.locale],
    ["property", "og:title", config.title],
    ["property", "og:description", config.og],
    ["property", "og:url", pageUrl],
    ["property", "og:image", imageUrl],
    ["property", "og:image:alt", config.alt],
    ["name", "twitter:title", config.title],
    ["name", "twitter:description", config.og],
    ["name", "twitter:image", imageUrl],
    ["name", "twitter:image:alt", config.alt]
  ];
  for (const [kind, key, value] of tags) updateMeta(lines, kind, key, value);

  lines = lines.filter(line =>
    !line.trim().startsWith('<link rel="canonical"') &&
    !line.trim().startsWith('<link rel="alternate" hreflang=') &&
    !line.trim().startsWith('<base href=')
  );
  if (config.dir) {
    const charset = lines.findIndex(line => line.includes('<meta charset="utf-8">'));
    lines.splice(charset + 1, 0, '  <base href="../">');
  }

  const brand = lines.findIndex(line => line.includes('<a class="brand"'));
  if (brand >= 0) lines[brand] = replaceHref(lines[brand], config.dir ? "./" + code + "/" : "./");
  const skip = lines.findIndex(line => line.includes('<a class="skip-link"'));
  if (skip >= 0) lines[skip] = replaceHref(lines[skip], config.dir ? "./" + code + "/#main-content" : "#main-content");

  const alternates = [
    ["pt-PT", ORIGIN + SITE_PATH],
    ["en", ORIGIN + SITE_PATH + "en/"],
    ["es", ORIGIN + SITE_PATH + "es/"],
    ["x-default", ORIGIN + SITE_PATH]
  ];
  const headEnd = lines.indexOf("</head>");
  const links = [
    '  <link rel="canonical" href="' + pageUrl + '">',
    ...alternates.map(([lang, url]) => '  <link rel="alternate" hreflang="' + lang + '" href="' + url + '">')
  ];
  lines.splice(headEnd, 0, ...links);
  return lines.join("\n");
}

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const dictionaries = readTranslations();
const checkOnly = process.argv.includes("--check");
let failed = false;
for (const [code, config] of Object.entries(locales)) {
  const relativePath = config.dir ? path.join(config.dir, "index.html") : "index.html";
  const outputPath = path.join(ROOT, relativePath);
  const expected = render(template, code, config, dictionaries[code]);
  if (checkOnly) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== expected) {
      console.error("Localized page is missing or stale: " + relativePath);
      failed = true;
    } else {
      console.log("Localized page verified: " + relativePath);
    }
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, expected);
    console.log("Generated " + relativePath);
  }
}
if (failed) process.exitCode = 1;
