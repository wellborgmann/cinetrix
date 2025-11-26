import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";

import { cadastrar, login, solicitarRecuperacao, redefinirSenha } from "./auth.js";
import { criarPagamentoPix, consultarPagamento } from "./payment/mercadopago.js";
import { registrarAprovado, buscarPagamentos, diasRestantes } from "./payment/mercadopagoDB.js";
import midiasRouter from "./controllers/midias.js";
import { autenticarToken } from "./autenticarToken.js";
import { cast } from "./firebase.js";

dotenv.config();

const SECRET = process.env.SECRET;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

/* -----------------------------------------------------
   🔓 CORS TOTAL – Funciona até com HTML file://
------------------------------------------------------*/
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // permite file:// TV/app sem origin
    return cb(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Range"],
  exposedHeaders: ["Content-Range", "Content-Length"],
  credentials: true
}));

/* -----------------------------------------------------
   Middlewares
------------------------------------------------------*/
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* -----------------------------------------------------
   Rotas públicas (HTML)
------------------------------------------------------*/
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "index.html"))
);

app.get("/firebase", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "firebase.html"))
);

app.get("/tv", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "tv.html"))
);

app.get("/forgot", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "forgot.html"))
);

app.get("/reset", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "reset.html"))
);

app.get("/home", autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/pix", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "pix.html"));
});

/* -----------------------------------------------------
   🔥 PROXY QUE PERMITE HTTP → HTTPS E STREAMING
------------------------------------------------------*/
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("URL inválida");

  try {
    const range = req.headers.range;
    const headers = {};

    if (range) headers.Range = range;

    const response = await fetch(url, { headers });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body && response.body.pipe) {
      response.body.pipe(res);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }

  } catch (err) {
    console.error("Erro no proxy:", err);
    res.status(500).send("Erro ao buscar vídeo");
  }
});

/* -----------------------------------------------------
   Enviar streaming para TV
------------------------------------------------------*/
app.post("/send", async (req, res) => {
  const { tvId, url } = req.body;
  const streaming = false;
  if (!tvId || !url) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  try {
    await cast(tvId, url, streaming);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(400).send();
  }
});

/* -----------------------------------------------------
   Cadastro / Login
------------------------------------------------------*/
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
    const { email, senha, deviceId} = req.body;
    const result = await login(email, senha);
    console.log("deviceId",deviceId)
    const token = jwt.sign({ id: result.id, email }, SECRET, {
      expiresIn: "12h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
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

/* -----------------------------------------------------
   Recuperação de senha
------------------------------------------------------*/
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

/* -----------------------------------------------------
   Pagamentos PIX
------------------------------------------------------*/
app.post("/create-pix-payment", async (req, res) => {
  try {
    const { quant, description, email } = req.body;

    if (!email || !description || !quant)
      return res.status(400).json({ error: "Dados inválidos" });

    const amount = quant * 10;

    const response = await criarPagamentoPix(amount, description, email);
    res.json(response);

  } catch (err) {
    console.error("Erro PIX:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});



/* -----------------------------------------------------
   Webhook Mercado Pago
------------------------------------------------------*/
app.post("/webhook", async (req, res) => {
  try {
    const id = req.body.data.id;
    if (!id) return res.status(400).send("ID ausente");

    console.log("Webhook recebido:", id);

    const pagamento = await consultarPagamento(id);
    const banco = await buscarPagamentos(id);

    if (!banco || pagamento.status !== "approved" || banco.status !== "pending") {
      return res.status(400).send("Pagamento não aprovado");
    }

    await registrarAprovado(banco.email);

    res.sendStatus(200);

  } catch (err) {
    console.error("Erro webhook:", err);
    res.status(500).json({ error: "Erro ao processar webhook" });
  }
});


app.get("/validade", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email não informado" });
    }

    const dias = await diasRestantes(email);

    if (dias === null) {
      // Não existe pagamento → período de teste
      return res.status(200).json({
        mensagem: "Período de teste",
       
      });
    }

    // Assinatura válida
    return res.status(200).json({
      mensagem: `Você tem ${dias} dias`
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Erro interno" });
  }
});

//http://pr1m3.fun/get.php?username=francielma@freidamiao&password=francielma@&type=m3u_plus
/* -----------------------------------------------------
   Rotas de mídias
------------------------------------------------------*/
app.use("/api/midias", midiasRouter);


export default app;
