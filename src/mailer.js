import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true se usar porta 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function enviarEmail(to, assunto, html) {
  await transporter.sendMail({
    from: `"Suporte" <${process.env.SMTP_USER}>`,
    to,
    subject: assunto,
    html
  });
}
