import fs from "fs";
import readline from "readline";
import path from "path";

const LOCAL_FILE = path.resolve("./lista.txt"); // arquivo de entrada
const OUTPUT_JSON = path.resolve("./lista.json"); // arquivo de saída

global.Midias = { movies: [], channels: [], series: {} };
let originalMidias = {};
let todoConteudo = [];

// -------------------------
// Funções auxiliares
// -------------------------

function extractValue(line, key) {
  const startIndex = line.indexOf(key);
  if (startIndex === -1) return "";
  const startQuote = line.indexOf('"', startIndex);
  if (startQuote === -1) return "";
  const endQuote = line.indexOf('"', startQuote + 1);
  return endQuote !== -1 ? line.substring(startQuote + 1, endQuote) : "";
}

function extractChannelName(line) {
  const idx = line.lastIndexOf(",");
  return idx !== -1 ? line.substring(idx + 1).trim() : "";
}

function organizarDados(list) {
  const grouped = {};
  for (const item of list) {
    const g = item.group;
    if (!grouped[g]) grouped[g] = { group: g, items: [] };
    grouped[g].items.push(item);
  }
  return Object.values(grouped);
}

// -------------------------
// Parsing do arquivo linha a linha
// -------------------------

async function parseM3U8Stream(filePath) {
  const list = [];
  let prevLine = "";

  const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (prevLine.startsWith("#EXTINF")) {
      const id = extractValue(prevLine, "tvg-id");
      const name = extractValue(prevLine, "tvg-name");
      const capa = extractValue(prevLine, "tvg-logo");
      const group = extractValue(prevLine, "group-title") || "- Sem grupo";
      const channel = extractChannelName(prevLine);
      const link = line.trim();

      if (link && (link.startsWith("http://") || link.startsWith("https://")))
        list.push({ group, name, capa, id, channel, link });
    }
    prevLine = line;
  }

  return organizarDados(list);
}

// -------------------------
// Funções de organização
// -------------------------

function listaCompleta() {
  const filtrado = todoConteudo.filter((a) => a.group.toLowerCase() !== "onlyfans");
  return filtrado.flatMap((obj) => obj.items);
}

async function organizeMedia(list) {
  const organized = { series: {}, movies: [], channels: [] };
  const regexSerie = /^(.*?)[\s._-]*[Ss](\d{1,2})[Ee](\d{1,2})/;

  for (const item of list) {
    if (!item.link || !item.name) continue;
    const link = item.link.trim();

    if (link.includes("/series/") || regexSerie.test(item.channel)) {
      const match = item.channel.match(regexSerie);
      const seriesName = match ? match[1].trim() : item.channel;
      const season = match ? match[2] : "1";
      const episode = match ? match[3] : "?";
      if (!organized.series[seriesName]) organized.series[seriesName] = [];
      organized.series[seriesName].push({ ...item, season, episode });
    } else if (link.includes("/movie/")) {
      organized.movies.push(item);
    } else {
      organized.channels.push(item);
    }
  }

  // Inverte episódios de cada série
  for (const serie in organized.series) {
    organized.series[serie].reverse();
  }

  return organized;
}

// -------------------------
// Carregamento principal
// -------------------------

export async function carregarMidias() {
  if (global.Midias.movies.length) return;

  try {
    todoConteudo = await parseM3U8Stream(LOCAL_FILE);
    const midiasOrganizadas = await organizeMedia(listaCompleta());
    global.Midias = midiasOrganizadas;
    originalMidias = midiasOrganizadas; // sem JSON.parse/JSON.stringify

    // salva em JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(midiasOrganizadas, null, 2), "utf-8");

    console.log("✅ Lista carregada e salva em JSON:", OUTPUT_JSON);
  } catch (err) {
    console.error("❌ Erro ao carregar lista:", err.message);
  }
}

carregarMidias();

// -------------------------
// Busca
// -------------------------

