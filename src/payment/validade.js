import { buscarPagamentosEmail } from "./mercadopagoDB.js";

// Função que verifica se o pagamento ainda está na validade
export async function verificarValidade(req, res, next) {
  try {
    const email = req.usuario.email;
    const pagamento = await buscarPagamentosEmail(email);

    // ✅ Verifica se pagamento existe
    if (!pagamento || !pagamento.created_at) {
      console.log("⚠️ Pagamento não encontrado ou sem data de criação." , email);
      return res.status(403).json({ sucesso: false, erro: "Acesso negado: pagamento não encontrado." });
    }

    // ✅ Verifica se status é aprovado
    if (pagamento.status !== "approved") {
      console.log("⚠️ Pagamento não aprovado.");
      return res.status(403).json({ sucesso: false, erro: "Pagamento não aprovado." });
    }

    const dataPagamento = new Date(pagamento.created_at);
    const validade = new Date(dataPagamento);
    validade.setDate(validade.getDate() + 30); // adiciona 30 dias de validade
    const hoje = new Date();

    console.log(`📅 Pagamento criado em: ${dataPagamento.toLocaleString()}`);
    console.log(`📆 Válido até: ${validade.toLocaleString()}`);

    // ✅ Verifica se está dentro da validade
    if (hoje > validade) {
      console.log("❌ Pagamento expirado!");
      return res.status(403).json({ sucesso: false, erro: "Acesso expirado! Renove seu pagamento." });
    }

    console.log("✅ Acesso liberado!");
    next();
  } catch (error) {
    console.error("❌ Erro ao verificar validade:", error);
    res.status(500).json({ sucesso: false, erro: "Erro ao verificar pagamento." });
  }
}
