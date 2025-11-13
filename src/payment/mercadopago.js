import { MercadoPagoConfig, Payment } from "mercadopago";
import dotenv from "dotenv";
dotenv.config();
import { salvarPagamento  } from "./mercadopagoDB.js";

const client = new MercadoPagoConfig({
  accessToken: process.env.accessToken,
});

const payment = new Payment(client);


export async function criarPagamentoPix(amount, description, email, notificationUrl = "http://157.254.54.238:3001/webhook") {

const agora = new Date().toISOString().split('T')[0];
let backup_id;

  try {
    const response = await payment.create({
      body: {
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        payer: { email },
        notification_url: notificationUrl,
      },
      requestOptions: {
        idempotencyKey: `${agora}/${amount}`,
      },
    });

    console.log("✅ Pagamento criado com sucesso!");
    backup_id = response.id
    const save = {email, amount, payment_id: response.id, status: response.status, json: response }
    await salvarPagamento(save);
    return response;
  } catch (error) {
    console.error("❌ Erro ao criar pagamento:", error);
    cancelarPagamento(backup_id);
    throw error;
  }
}



export async function cancelarPagamento(paymentId) {
  try {
    if (!paymentId) {
      throw new Error("ID do pagamento é obrigatório para cancelar.");
    }
    const response = await payment.cancel({ id: paymentId });
    console.log(`✅ Pagamento ${paymentId} cancelado com sucesso.`);
    return response;
  } catch (error) {
    console.error("❌ Erro ao cancelar pagamento:", error);
    throw error;
  }
}


