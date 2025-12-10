import db from "./db.js";
import { randomBytes } from "crypto";
import { enviarEmail } from "./mailer.js";
import bcrypt from "bcrypt"; // ✅ corrigido

// Cadastro
export async function cadastrar(email, senha) {
  try {
    const existe = await db.query("SELECT id FROM login WHERE email = ?", [email]);
    if (existe.length > 0) throw new Error("E-mail já cadastrado.");

    const senhaHash = await bcrypt.hash(String(senha), 10); // garante string
    const result = await db.execute(
      "INSERT INTO login (email, senha) VALUES (?, ?)",
      [email, senhaHash]
    );

    return { sucesso: true, id: result.insertId };
  } catch (err) {
    console.error("Erro no cadastro:", err);
    throw err;
  }
}

// Login
export async function login(email, senha) {
  try {
    const users = await db.query("SELECT id, senha FROM login WHERE email = ?", [email]);
    if (users.length === 0) throw new Error("Usuário não encontrado.");

    const user = users[0];
    const senhaCorreta = await bcrypt.compare(String(senha), user.senha);
    if (!senhaCorreta) throw new Error("Senha incorreta.");

    return { sucesso: true, id: user.id };
  } catch (err) {
    console.error("Erro no login:", err);
    throw err;
  }
}

// Recuperação de senha
export async function solicitarRecuperacao(email) {
  const usuarios = await db.query("SELECT id FROM login WHERE email = ?", [email]);
  if (usuarios.length === 0) throw new Error("E-mail não encontrado.");

  const token = randomBytes(32).toString("hex");
const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 horas


  await db.execute(
    "UPDATE login SET reset_token = ?, reset_expires = ? WHERE email = ?",
    [token, expires, email]
  );

  const link = `${process.env.FRONT_URL}/reset?token=${token}`;
  await enviarEmail(email, "Recuperação de Senha", `
    <h3>Recuperação de Senha</h3>
    <p>Clique no link abaixo para redefinir sua senha:</p>
    <a href="${link}" target="_blank">${link}</a>
    <p>Esse link expira em 15 minutos.</p>
  `);

  return { sucesso: true, mensagem: "E-mail de recuperação enviado!" };
}

// Redefinir senha
export async function redefinirSenha(token, novaSenha) {
  const usuarios = await db.query(
    "SELECT id FROM login WHERE reset_token = ? AND reset_expires > NOW()",
    [token]
  );

  if (usuarios.length === 0) throw new Error("Token inválido ou expirado.");

  const senhaHash = await bcrypt.hash(String(novaSenha), 10);

  await db.execute(
    "UPDATE login SET senha = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
    [senhaHash, usuarios[0].id]
  );

  return { sucesso: true, mensagem: "Senha redefinida com sucesso!" };
}



