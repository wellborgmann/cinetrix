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
      created: result.created_at || result.created,
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
        created: result.created_at || result.created || null,
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
      created: result.created_at || result.created || null,
      status: result.status || null,
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

export async function registrarAprovado(email, created_at = nowMysqlFormat()) {
  try {
    const sql = `
      UPDATE pagamentos
      SET created_at = ?
      WHERE email = ?
    `;
    return await db.execute(sql, [created_at, email]);
  } catch (error) {
    throw error;
  }
}


