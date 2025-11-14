const REMOTE_URL = "https://github.com/wellborgmann2/FILMES/raw/refs/heads/main/lista.txt";

global.Midias = { movies: [], channels: [], series: {} };
let originalMidias = {};
let todoConteudo = [];

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

function parseM3U8(text) {
  const list = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXTINF")) {
      const id = extractValue(line, "tvg-id");
      const name = extractValue(line, "tvg-name");
      const capa = extractValue(line, "tvg-logo");
      const group = extractValue(line, "group-title") || "- Sem grupo";
      const channel = extractChannelName(line);
      const link = lines[i + 1]?.trim();

      if (link && (link.startsWith("http://") || link.startsWith("https://")))
        list.push({ group, name, capa, id, channel, link });
    }
  }
  return organizarDados(list);
}

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
  return organized;
}

export async function carregarMidias() {
  if (global.Midias.movies.length) return; // evita recarregar
  try {
    const response = await fetch(REMOTE_URL);
    const text = await response.text();
    todoConteudo = parseM3U8(text);
    const midiasOrganizadas = await organizeMedia(listaCompleta());
    global.Midias = midiasOrganizadas;
    originalMidias = JSON.parse(JSON.stringify(midiasOrganizadas));
    console.log("✅ Lista carregada");
  } catch (err) {
    console.error("Erro ao carregar lista:", err.message);
  }
}

export function buscarDados(searchTerm) {
  if (!searchTerm) return originalMidias;

  const MidiasSearch = {
    channels: originalMidias.channels.filter((c) =>
      c.name.toLowerCase().includes(searchTerm)
    ),
    movies: originalMidias.movies.filter((f) =>
      f.name.toLowerCase().includes(searchTerm)
    ),
    series: [],
  };

  for (const [key, eps] of Object.entries(originalMidias.series)) {
    const encontrados = eps.filter((e) =>
      e.name.toLowerCase().includes(searchTerm)
    );
    if (encontrados.length > 0)
      MidiasSearch.series.push({ name: key, items: encontrados });
  }

  return MidiasSearch;
}