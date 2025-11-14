import { buscarPagamentosEmail } from "./mercadopagoDB.js";

export async function verificarValidade(req, res, next) {
  try {
    const email = req.usuario.email;

    const pagamento = await buscarPagamentosEmail(email);
    console.log("📌 Pagamento encontrado:", pagamento);

    if (!pagamento) {
      console.log("⚠️ Nenhum pagamento encontrado p/ email:", email);
      return res.status(403).json({ erro: "Pagamento não encontrado." });
    }

    // Corrige campo da data
    const created = pagamento.created_at || pagamento.created || pagamento.createdAt;

    if (!created) {
      console.log("⚠️ Pagamento sem campo de data:", pagamento);
      return res.status(403).json({ erro: "Pagamento inválido (sem data)." });
    }

    if (pagamento.status !== "approved") {
      console.log("⚠️ Pagamento NÃO aprovado:", pagamento.status);
      return res.status(403).json({ erro: "Pagamento não aprovado." });
    }

    const dataPagamento = new Date(created);
    const validade = new Date(dataPagamento);
    validade.setDate(validade.getDate() + 30);

    const hoje = new Date();

    console.log(`📅 Criado: ${dataPagamento}`);
    console.log(`📆 Válido até: ${validade}`);

    if (hoje > validade) {
      console.log("❌ Pagamento expirado");
      return res.status(403).json({ erro: "Pagamento expirado." });
    }

    console.log("✅ Acesso liberado!");
    next();

  } catch (err) {
    console.error("Erro na verificação:", err);
    res.status(500).json({ erro: "Erro interno." });
  }
}
