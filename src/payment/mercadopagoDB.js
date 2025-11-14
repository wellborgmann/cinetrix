import db from "../db.js";
import { cancelarPagamento } from "./mercadopago.js"; 
export async function salvarPagamento(paymentData) {
  try {
    const sql = `
      INSERT INTO pagamentos (email, amount, payment_id, status, response)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        status = VALUES(status),
        response = VALUES(response),
        payment_id = VALUES(payment_id)
    `;

    const params = [
      paymentData.email,
      paymentData.amount,
      paymentData.payment_id,
      paymentData.status,
      JSON.stringify(paymentData.json),
    ];

    return await db.execute(sql, params);

  } catch (error) {
    console.error("❌ Erro ao salvar ou atualizar pagamento:", error);
    throw error;
  } finally {
    console.log("✅ Finalizado tentativa de salvar/atualizar pagamento.");
  }
}
  



// --- BUSCAR PAGAMENTO ---
export async function buscarPagamentos(paymentId) {
  try {
    const sql = "SELECT * FROM pagamentos WHERE payment_id = ?";
    const [rows] = await db.execute(sql, [paymentId]);

    if (!rows || rows.length === 0) {
      throw new Error("Pagamento não encontrado.");
    }

    const result = rows[0];
    let response;

    try {
      response = JSON.parse(result.response);
    } catch (err) {
      console.error("⚠️ Erro ao interpretar JSON:", result.response);
      throw new Error("JSON inválido no campo 'response'.");
    }

    const data = response?.point_of_interaction?.transaction_data || {};

    return {
      id: result.payment_id,
      url: data.ticket_url || null,
      copy: data.qr_code || null,
      qr_code: data.qr_code_base64 || null,
      created: result.created,
      created_at: result.created_at,
      amount: result.amount
    };
  } catch (error) {
    console.error("❌ Erro ao buscar pagamento:", error);
    throw error;
  }
}


export async function buscarPagamentosEmail(email) {
  try {
    const sql = "SELECT * FROM pagamentos WHERE email = ?";
    const [rows] = await db.execute(sql, [email]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const result = rows;
  
    if (!result.response) {
      console.warn("⚠️ Campo 'response' ausente ou indefinido no registro:", result);
      return {
        id: result.payment_id || null,
        url: null,
        copy: null,
        qr_code: null,
      created: result.created,
      created_at: result.created_at,
        status: result.status || null,
      };
    }

    let response =result.response
 
    const data = response?.point_of_interaction?.transaction_data || {};

    return {
      id: result.payment_id || null,
      url: data.ticket_url || null,
      copy: data.qr_code || null,
      qr_code: data.qr_code_base64 || null,
       created: result.created,
      created_at: result.created_at,
      status: result.status || null,
      amount: result.amount || null
    };
  } catch (error) {
    console.error("❌ Erro ao buscar pagamento:", error);
    throw error;
  }
}

function nowMysqlFormat() {
  const d = new Date();
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function registrarAprovado(email) {
  try {
    // Buscar pagamento atual
    const sqlSelect = `SELECT created_at, status FROM pagamentos WHERE email = ?`;
    const [rows] = await db.execute(sqlSelect, [email]);

if (!rows || rows.length === 0) {
  return null;
}

// Pega o primeiro registro do array
const result = Array.isArray(rows) ? rows[0] : rows;

    const atual = result;

    const antigoCreated = new Date(atual.created_at);
    const hoje = new Date();

    const diasPlano = 30;

    // Calcular validade
    const validade = new Date(antigoCreated);
    validade.setDate(validade.getDate() + diasPlano);

    let novoCreated;

    if (hoje > validade) {
      // VENCIDO → começa hoje
      novoCreated = hoje;
    } else {
      // NÃO VENCIDO → soma o restante
      const diasRestantes = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));

      novoCreated = new Date();
      novoCreated.setDate(novoCreated.getDate() + diasRestantes);
    }

    // Converter para padrão MySQL
    const createdMySQL = novoCreated.toISOString().slice(0, 19).replace("T", " ");

    // Atualizar no banco (DATA + STATUS)
    const sqlUpdate = `
      UPDATE pagamentos
      SET created_at = ?, status = 'approved'
      WHERE email = ?
    `;

    await db.execute(sqlUpdate, [createdMySQL, email]);

    console.log(`✅ Status atualizado para 'approved' e nova data: ${createdMySQL}`);

    return novoCreated;

  } catch (error) {
    console.error("❌ Erro em registrarAprovado:", error);
    throw error;
  }
}




