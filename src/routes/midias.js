import express from "express";
import { carregarMidias, buscarDados } from "../controllers/midiasController.js";
import { verificarValidade } from "../payment/validade.js";
import { autenticarToken } from "../autenticarToken.js";

const router = express.Router();

router.use((req, res, next) => {
  console.log("Cookies recebidos:", req.cookies);
  next();
});


router.use(autenticarToken);

// 🟢 Depois valida pagamento
router.use(verificarValidade);

await carregarMidias();

router.get("/:tipo", (req, res) => {
  const { tipo } = req.params;
  let { page = 1, limit = 24 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);

  let allItems = [];

  if (tipo === "filmes") allItems = global.Midias.movies || [];
  else if (tipo === "canais") allItems = global.Midias.channels || [];
  else if (tipo === "series") {
    allItems = Object.entries(global.Midias.series || {}).map(
      ([name, episodes]) => ({
        name,
        episodes,
        capa: episodes[0]?.capa,
      })
    );
  }

  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / limit);
  const start = (page - 1) * limit;
  const paginatedItems = allItems.slice(start, start + limit);

  res.json({ page, totalPages, totalItems, items: paginatedItems });
});

router.get("/series/:name", (req, res) => {
  const { name } = req.params;
  const episodes = global.Midias.series?.[name];
  if (!episodes) return res.status(404).json({ error: "Série não encontrada" });
  res.json(episodes);
});

router.get("/buscar/:query", (req, res) => {
  const result = buscarDados(req.params.query.toLowerCase());
  res.json(result);
});

export default router;