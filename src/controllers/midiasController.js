import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// --- Configuração de Caminhos ---
const JSON_FILE = path.resolve("./lista.json");
const DB_FILE = path.resolve("./midias.db");

// Inicializa o banco de dados
const db = new Database(DB_FILE); 

// Otimizações do SQLite
db.pragma('journal_mode = WAL');      // Permite leitura e escrita simultâneas
db.pragma('synchronous = NORMAL');    // Menos escrita em disco, mais velocidade
db.pragma('cache_size = -64000');     // Usa até ~64MB de RAM para cache do banco

// ==================================================================
// 1. CRIAÇÃO DAS TABELAS
// ==================================================================
function setupDatabase() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        group_title TEXT,
        capa TEXT,
        link TEXT,
        original_json TEXT
      );
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        group_title TEXT,
        capa TEXT,
        link TEXT,
        original_json TEXT
      );
      CREATE TABLE IF NOT EXISTS series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serie_name TEXT, 
        season TEXT,
        episode TEXT,
        name TEXT,       
        capa TEXT,
        link TEXT,
        original_json TEXT
      );
      
      -- Índices para busca rápida
      CREATE INDEX IF NOT EXISTS idx_movies_name ON movies(name);
      CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
      CREATE INDEX IF NOT EXISTS idx_series_name ON series(serie_name);
      
      -- Índice único para evitar duplicatas exatas de episódios
      CREATE UNIQUE INDEX IF NOT EXISTS idx_series_unique_ep 
      ON series(serie_name, season, episode);
    `);
}

setupDatabase(); 

// Prepared Statements para Inserção
const insertMovie = db.prepare(`INSERT INTO movies (name, group_title, capa, link, original_json) VALUES (?, ?, ?, ?, ?)`);
const insertChannel = db.prepare(`INSERT INTO channels (name, group_title, capa, link, original_json) VALUES (?, ?, ?, ?, ?)`);
const insertSerie = db.prepare(`
    INSERT OR REPLACE INTO series (serie_name, season, episode, name, capa, link, original_json) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ==================================================================
// 2. MIGRAÇÃO (JSON -> SQLite)
// ==================================================================
export async function carregarMidias() {
    try {
        // Verifica se já tem dados (evita recarregar toda vez)
        const count = db.prepare('SELECT count(*) as total FROM movies').get();
        if (count.total > 0) {
            console.log("✅ Banco de dados SQLite verificado e pronto.");
            return; 
        }

        if (!fs.existsSync(JSON_FILE)) {
            console.error("❌ Arquivo lista.json não encontrado!");
            return;
        }

        console.log("🔄 Iniciando migração do JSON para SQLite...");
        
        const data = fs.readFileSync(JSON_FILE, "utf-8");
        const midias = JSON.parse(data);

        // Transação torna a inserção muito mais rápida (em lote)
        const importTransaction = db.transaction((midias) => {
            db.prepare('DELETE FROM movies').run();
            db.prepare('DELETE FROM channels').run();
            db.prepare('DELETE FROM series').run();

            if (midias.movies) {
                for (const m of midias.movies) {
                    insertMovie.run(m.name, m.group || '', m.capa, m.link, JSON.stringify(m));
                }
            }

            if (midias.channels) {
                for (const c of midias.channels) {
                    insertChannel.run(c.name, c.group || '', c.capa, c.link, JSON.stringify(c));
                }
            }

            if (midias.series) {
                for (const [serieName, episodios] of Object.entries(midias.series)) {
                    if (!Array.isArray(episodios)) continue;
                    
                    for (const ep of episodios) {
                        const season = String(ep.season || "1");
                        const episode = String(ep.episode || "0");

                        insertSerie.run(
                            serieName, 
                            season, 
                            episode, 
                            ep.name, 
                            ep.capa, 
                            ep.link, 
                            JSON.stringify(ep)
                        );
                    }
                }
            }
        });

        importTransaction(midias);
        console.log("✅ Migração concluída!");

    } catch (err) {
        console.error("❌ Erro ao migrar JSON para SQLite:", err.message);
    }
}

// ==================================================================
// 3. CONSULTAS OTIMIZADAS (PAGINAÇÃO NO SQL)
// ==================================================================

export function getItemsPaginated(tipo, page = 1, limit = 24) {
    const offset = (page - 1) * limit;
    let items = [];
    let total = 0;

    if (tipo === 'filmes') {
        // 1. Conta o total (super rápido com índice)
        total = db.prepare('SELECT count(*) as total FROM movies').get().total;

        // 2. Busca apenas a página solicitada
        const rows = db.prepare('SELECT original_json FROM movies ORDER BY id ASC LIMIT ? OFFSET ?').all(limit, offset);
        items = rows.map(r => JSON.parse(r.original_json));
    } 
    else if (tipo === 'canais') {
        total = db.prepare('SELECT count(*) as total FROM channels').get().total;
        
        const rows = db.prepare('SELECT original_json FROM channels ORDER BY id ASC LIMIT ? OFFSET ?').all(limit, offset);
        items = rows.map(r => JSON.parse(r.original_json));
    } 
    else if (tipo === 'series') {
        // Conta séries únicas (agrupadas pelo nome)
        total = db.prepare('SELECT count(DISTINCT serie_name) as total FROM series').get().total;

        // Busca agrupada para listar apenas a "capa" da série
        const rows = db.prepare(`
            SELECT serie_name, original_json 
            FROM series 
            GROUP BY serie_name 
            ORDER BY id ASC 
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        items = rows.map(row => {
            const jsonItem = JSON.parse(row.original_json);
            return {
                name: row.serie_name,
                episodes: [], // Lista vazia na home para economizar dados
                capa: jsonItem.capa 
            };
        });
    }

    return { items, total };
}

export function getSerieByName(serieName) {
    // Traz todos os episódios da série específica
    const rows = db.prepare(`
        SELECT original_json 
        FROM series 
        WHERE serie_name = ? COLLATE NOCASE
        GROUP BY season, episode
        ORDER BY CAST(season AS INTEGER) ASC, CAST(episode AS INTEGER) ASC
    `).all(serieName);

    return rows.map(row => JSON.parse(row.original_json));
}

export function buscarDados(searchTerm) {
    const term = `%${searchTerm ? searchTerm.toLowerCase() : ''}%`; 

    // LIMIT 50 para garantir que a busca não trave se o termo for muito genérico (ex: "a")
    const limit = 50;

    const channels = db.prepare(`SELECT original_json FROM channels WHERE lower(name) LIKE ? LIMIT ?`).all(term, limit)
        .map(r => JSON.parse(r.original_json));

    const movies = db.prepare(`SELECT original_json FROM movies WHERE lower(name) LIKE ? LIMIT ?`).all(term, limit)
        .map(r => JSON.parse(r.original_json));
    
    const seriesRows = db.prepare(`
        SELECT serie_name, original_json FROM series 
        WHERE lower(serie_name) LIKE ? 
        GROUP BY serie_name
        LIMIT ?
    `).all(term, limit);

    const series = seriesRows.map(row => {
         const item = JSON.parse(row.original_json);
         return {
             name: row.serie_name,
             items: [item] 
         };
    });

    return { channels, movies, series };
}