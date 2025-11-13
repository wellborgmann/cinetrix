import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { cadastrar, login, solicitarRecuperacao, redefinirSenha } from "./auth.js";
import { criarPagamentoPix } from "./payment/mercadopago.js";
import { verificarValidade } from "./payment/validade.js"; 
import {registrarAprovado} from "./db.js"

dotenv.config();

const SECRET = process.env.SECRET;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Middleware de autenticação via cookie
function autenticarToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ sucesso: false, erro: "Token não fornecido" });

  jwt.verify(token, SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ sucesso: false, erro: "Token inválido" });
    req.usuario = usuario;
    next();
  });
}


// Rotas públicas
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/forgot", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "forgot.html"));
});

app.get("/reset", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "reset.html"));
});

// ✅ Rota protegida
app.get("/home", autenticarToken, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/pix", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "pix.html"));
});

// APIs
app.post("/api/cadastro", async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await cadastrar(email, senha);
    res.json({ sucesso: true, id: result.id });
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await login(email, senha);
    const token = jwt.sign({ id: result.id, email }, SECRET, { expiresIn: "1h" });

    // ✅ Salva o token em cookie HttpOnly
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true se usar HTTPS
      sameSite: "strict",
      maxAge: 3600000, // 1h
    });

    res.json({ sucesso: true });
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ sucesso: true });
});

app.post("/api/recuperar", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await solicitarRecuperacao(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.post("/api/resetar", async (req, res) => {
  const { token, senha } = req.body;
  try {
    const result = await redefinirSenha(token, senha);
    res.json(result);
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});


app.post("/webhook", async (req, res) => {
  //registrarAprovado(req.email)
  console.log("✅ Webhook recebido:", req.body);
    
  
});

app.post("/api/midias", autenticarToken, verificarValidade, (req, res)=>{
  res.status(200).json({ sucesso: true, mensagem: "teste" });
});

app.post("/create-pix-payment", async (req, res) => {
  const { amount, description, email } = req.body;
  try {
    console.log(email)
    if(!email || !description || !amount)return
    const response = await criarPagamentoPix(amount, description, email); 

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar pagamento PIX" });
  }
}); 