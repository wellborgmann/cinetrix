import express from "express";
import NodeCache from "node-cache"; 
import { carregarMidias, buscarDados, getItemsPaginated, getSerieByName } from "./midiasController.js"; 
import { verificarValidade } from "../payment/validade.js";
import { autenticarToken } from "../autenticarToken.js";

const router = express.Router();

// Cache de validação de usuário (30 minutos)
const cacheValidade = new NodeCache({ stdTTL: 1800 }); 

// Cache de busca (5 minutos)
const cacheBusca = new NodeCache({ stdTTL: 300 });

// Middleware GLOBAL para medir o tempo da requisição
router.use((req, res, next) => {
  const start = performance.now();

  res.on("finish", () => {
    const end = performance.now();
    const duration = (end - start).toFixed(2);
    console.log(`[${req.method}] ${req.originalUrl} → ${duration}ms`);
  });

  next();
});

router.use(autenticarToken);

// Middleware de verificação de pagamento
router.use((req, res, next) => {
  const userEmail = req.user?.email;

  if (userEmail && cacheValidade.has(userEmail)) {
    return next();
  }

  verificarValidade(req, res, () => {
    if (userEmail) {
      cacheValidade.set(userEmail, true);
    }
    next();
  });
});

// Inicializa o banco
await carregarMidias();

// Rotas
router.get("/:tipo", (req, res) => {
  const { tipo } = req.params;
  let { page = 1, limit = 24 } = req.query;

  page = Math.max(1, parseInt(page) || 1);
  limit = Math.max(1, parseInt(limit) || 24);

  if (!['filmes', 'canais', 'series'].includes(tipo)) {
    return res.status(400).json({ error: "Tipo de mídia inválido" });
  }

  try {
    const { items, total } = getItemsPaginated(tipo, page, limit);
    const totalPages = Math.ceil(total / limit);

    res.json({
      page,
      totalPages,
      totalItems: total,
      items
    });

  } catch (error) {
    console.error("Erro na rota /:tipo:", error);
    res.status(500).json({ error: "Erro interno ao buscar mídias" });
  }
});

router.get("/series/:name", (req, res) => {
  try {
    const episodes = getSerieByName(req.params.name);

    if (!episodes || episodes.length === 0) {
      return res.status(404).json({ error: "Série não encontrada" });
    }

    res.json(episodes);
  } catch (error) {
    console.error("Erro ao buscar série:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/buscar/:query", (req, res) => {
  const query = req.params.query.toLowerCase();

  if (cacheBusca.has(query)) {
    return res.json(cacheBusca.get(query));
  }

  try {
    const result = buscarDados(query);
    cacheBusca.set(query, result);
    res.json(result);
  } catch (error) {
    console.error("Erro na busca:", error);
    res.status(500).json({ error: "Erro ao realizar busca" });
  }
});

export default router;
