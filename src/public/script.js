
const form = document.getElementById("form");
const linkToggle = document.getElementById("linkToggle");
const titulo = document.getElementById("titulo");
const btnSubmit = document.getElementById("btnSubmit");
const msg = document.getElementById("mensagem");

let modoCadastro = false;

linkToggle.addEventListener("click", (e) => {
  e.preventDefault();
  modoCadastro = !modoCadastro;
  titulo.textContent = modoCadastro ? "Cadastro" : "Entrar";
  btnSubmit.textContent = modoCadastro ? "Cadastrar" : "Entrar";
  linkToggle.textContent = modoCadastro ? "Entrar" : "Cadastre-se";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  const endpoint = modoCadastro ? "/api/cadastro" : "/api/login";

  msg.textContent = "Carregando...";
  msg.style.color = "blue";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
      credentials: "include" // 🔥 envia e recebe cookies
    });

    const data = await res.json();
    if (data.sucesso) {
      msg.textContent = "Login realizado!";
      msg.style.color = "green";
      window.location.href = "/home";
    } else {
      msg.textContent = data.erro || "Erro inesperado.";
      msg.style.color = "red";
    }
  } catch (error) {
    msg.textContent = "Falha ao conectar.";
    msg.style.color = "red";
  }
});

