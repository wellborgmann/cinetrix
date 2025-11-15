import { buscarPagamentosEmail, infoCadastro } from "./mercadopagoDB.js";

export async function verificarValidade(req, res, next) {
  try {
    // 🛑 PRIMEIRA PROTEÇÃO: verificar se o usuário existe
    if (!req.usuario || !req.usuario.email) {
      console.log("❌ Nenhum usuário no req. Token inválido ou não enviado.");
      return res.status(401).json({ erro: "Token inválido ou ausente." });
    }

    const email = req.usuario.email;
    console.log("🔎 Verificando pagamento do email:", email);
    const periodoDeTeste = await infoCadastro(email);
    if(periodoDeTeste.validade)next()
    // Buscar pagamento no banco
    const pagamento = await buscarPagamentosEmail(email);
    console.log("📌 Pagamento encontrado:", pagamento);

    // Pagamento não existe
    if (!pagamento) {
      console.log("⚠️ Nenhum pagamento encontrado para:", email);
      return res.status(403).json({ erro: "Pagamento não encontrado." });
    }

    // Campo de data
    const created = pagamento.created_at || pagamento.created || pagamento.createdAt;

    if (!created) {
      console.log("⚠️ Pagamento sem campo de data:", pagamento);
      return res.status(403).json({ erro: "Pagamento inválido (sem data)." });
    }

    // Status
    if (pagamento.status !== "approved") {
      console.log("⚠️ Pagamento NÃO aprovado:", pagamento.status);
      return res.status(403).json({ erro: "Pagamento não aprovado." });
    }

    // Validar data
    const dataPagamento = new Date(created);
    const validade = new Date(dataPagamento);
    validade.setDate(validade.getDate() + 30);

    const hoje = new Date();

    console.log("📅 Criado em:", dataPagamento);
    console.log("📆 Válido até:", validade);

    if (hoje > validade) {
      console.log("❌ Pagamento expirado");
      return res.status(403).json({ erro: "Pagamento expirado." });
    }

    console.log("✅ Pagamento válido. Acesso liberado!");
    next();

  } catch (err) {
    console.error("Erro na verificação de validade:", err);
    return res.status(500).json({ erro: "Erro interno." });
  }
}
