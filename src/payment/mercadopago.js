  import { MercadoPagoConfig, Payment } from "mercadopago";
  import dotenv from "dotenv";
  dotenv.config();
  import { salvarPagamento, buscarPagamentosEmail, registrarAprovado} from "./mercadopagoDB.js";

  const client = new MercadoPagoConfig({
    accessToken: process.env.accessToken,
  });

  const payment = new Payment(client);

  function nowMysqlFormat() {
    const d = new Date();
    return d.toISOString().slice(0, 19).replace("T", " ");
  }

  export async function criarPagamentoPix(amount, description, email, notificationUrl = "https://cinetrix.vercel.app/webhook") {
    let backup_id = null;

    try {
      console.log("email", email);

      const pagamentoDB = await buscarPagamentosEmail(email);
      const hoje = new Date();
      let deveCriarNovo = false;

      // Caso exista pagamento prévio
      if (pagamentoDB) {
        const dataPagamento = new Date(pagamentoDB.created);
        const validade = new Date(dataPagamento);
        validade.setDate(validade.getDate() + 2); // validade de 2 dias

        // REGRAS para gerar novo pagamento:
        if (pagamentoDB.status === "cancelled") deveCriarNovo = true;
        if (hoje > validade) deveCriarNovo = true;
      } 
      else {
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
  }
});


        backup_id = response.id;

        const save = {
          email,
          amount,
          payment_id: response.id,
          status: response.status,
          json: response,
        };

        await salvarPagamento(save);

      } else {
        console.log("*** Usando pagamento existente");

        // uso o JSON salvo no banco
        response = pagamentoDB.json;
      }

      console.log("✅ Pagamento retornado com sucesso!");
      return response;

    } catch (error) {
      console.error("❌ Erro ao criar pagamento:", error);

      if (backup_id) {
        console.log("Cancelando pagamento criado antes do erro...");
        await cancelarPagamento(backup_id);
      }

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


export async function consultarPagamento(paymentId) {
  try {
    const response = await payment.get({ id: paymentId });

    console.log("Status:", response.status);
    console.log("Detalhes:", response);

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

