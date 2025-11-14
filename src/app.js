import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import { cadastrar, login, solicitarRecuperacao, redefinirSenha } from "./auth.js";
import { criarPagamentoPix, consultarPagamento } from "./payment/mercadopago.js";
import { registrarAprovado } from "./payment/mercadopagoDB.js";
import { buscarPagamentos } from "./payment/mercadopagoDB.js"; // <– coloquei pq vc usa no webhook
import midiasRouter from "./routes/midias.js";
import { autenticarToken } from "./autenticarToken.js";
dotenv.config();

const SECRET = process.env.SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares globais
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Middleware de autenticação


// Rotas públicas
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "index.html"))
);
app.get("/forgot", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "forgot.html"))
);
app.get("/reset", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "reset.html"))
);

// Rota protegida
app.get("/home", autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/pix",  (req, res) => {
  res.sendFile(path.join(__dirname, "views", "pix.html"));
});

// Rotas APIs
app.post("/api/cadastro", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const result = await cadastrar(email, senha);
    res.json({ sucesso: true, id: result.id });
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const result = await login(email, senha);
    const token = jwt.sign({ id: result.id, email }, SECRET, {
      expiresIn: "1h",
    });

res.cookie("token", token, {
  httpOnly: true,
  sameSite: "lax",  // <-- permite envio de cookies no localhost
  secure: false,    // <-- necessário para HTTP normal
  maxAge: 3600000
});


    res.json({ sucesso: true });
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.post("/api/logout", (_, res) => {
  res.clearCookie("token");
  res.json({ sucesso: true });
});

// Recuperação de senha
app.post("/api/recuperar", async (req, res) => {
  try {
    const result = await solicitarRecuperacao(req.body.email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.post("/api/resetar", async (req, res) => {
  try {
    const { token, senha } = req.body;
    const result = await redefinirSenha(token, senha);
    res.json(result);
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

// PIX
app.post("/create-pix-payment", async (req, res) => {
  try {
    const { quant, description, email } = req.body;

    if (!email || !description || !quant) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const amount = quant * 0.05; // sem espaço, sem erro

    const response = await criarPagamentoPix(amount, description, email);

    res.json(response);

  } catch (err) {
    console.error("❌ Erro ao criar pagamento PIX:", err);
    res.status(500).json({ error: {quant, description, email} });
  }
});

// Webhook Mercado Pago
app.post("/webhook", async (req, res) => {
  try {
    const id = req?.body?.id;
    if (!id) return res.status(400).send("ID ausente");

    console.log("Webhook recebido:", id);

    const pagamento = await consultarPagamento(id);
    const banco = await buscarPagamentos(id);

    if (!banco || banco.status === "approved" || pagamento.status !== "approved")
  

    await registrarAprovado(banco.email);
    return res.sendStatus(200);
    
  } catch {
    res.status(500).json({ error: "Erro ao processar webhook" });
  }
});

// Rotas protegidas de conteúdo
app.use("/api/midias", midiasRouter);

// Exporta o app sem iniciar servidor
export default app;
