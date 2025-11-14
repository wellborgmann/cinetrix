  import { MercadoPagoConfig, Payment } from "mercadopago";
  import dotenv from "dotenv";
  dotenv.config();
  import { salvarPagamento, buscarPagamentosEmail, registrarAprovado} from "./mercadopagoDB.js";
import { json } from "express";

  const client = new MercadoPagoConfig({
    accessToken: process.env.accessToken,
  });

  const payment = new Payment(client);

  function nowMysqlFormat() {
    const d = new Date();
    return d.toISOString().slice(0, 19).replace("T", " ");
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


export async function consultarPagamento(paymentId) {
  try {
    const response = await payment.get({ id: paymentId });

    //console.log("Status:", response.status);
    //console.log("Detalhes:", response);
    return response
       if (response.payer) {
      console.log("Email do payer:", response.payer.email);
    } else {
      console.log("⚠ Nenhum payer retornado.");
    }
    return response;

  } catch (error) {
    console.error("❌ Erro ao consultar pagamento:", error);
    throw error;
  }
}



export async function criarPagamentoPix(amount, description, email, notificationUrl = "https://cinetrix.vercel.app/webhook") {
  try {
    console.log(`xxxx ${email}, ${amount}, ${description}, ${email}`);

    const pagamentoDB = await buscarPagamentosEmail(email);
    const hoje = new Date();
    let deveCriarNovo = false;

    if (pagamentoDB && pagamentoDB?.amount) {
      const dataPagamento = new Date(pagamentoDB.created);
      const validade = new Date(dataPagamento);
      validade.setDate(validade.getDate() + 2);

      if (pagamentoDB.status === "cancelled" || pagamentoDB.status === "approved") deveCriarNovo = true;
      if (hoje.getTime() > validade.getTime()) deveCriarNovo = true;
      if (Number(pagamentoDB.amount) !== Number(amount)) deveCriarNovo = true;
    } else {
      deveCriarNovo = true;
    }

    let response;
    if (deveCriarNovo) {
      console.log("*** Criando novo pagamento");
      response = await payment.create({
        body: {
          transaction_amount: amount,
          description,
          payment_method_id: "pix",
          payer: { email },
          notification_url: notificationUrl,
        },
      });

      const save = {
        email,
        amount,
        payment_id: response.id,
        status: response.status,
        json: response,
        created_at: nowMysqlFormat(),
      };

      await salvarPagamento(save);


      return {
        id: response.id || null,
        url: response.point_of_interaction.transaction_data.ticket_url || null,
        copy: response.point_of_interaction.transaction_data.qr_code || null,
        qr_code: response.point_of_interaction.transaction_data.qr_code_base64 || null,
        created: save.created_at,
        status: response.status,
      };
    } else {

      return {
        id: pagamentoDB.id,
        url: pagamentoDB.url || null,
        copy: pagamentoDB.copy || null,
        qr_code: pagamentoDB.qr_code || null,
        created: pagamentoDB.created || null,
        created_at: pagamentoDB.created_at || null,
        status: pagamentoDB.status,
      };
    }
  } catch (error) {
    console.error("❌ Erro ao criar pagamento:", error);
    throw error;
  }
}







(async()=>{

  //const data = await criarPagamento(10, "Assinatura de 1 mês(es)", "wellborgmann2@gmail.com");
  //console.log(data);

})()