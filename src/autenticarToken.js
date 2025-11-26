import jwt from "jsonwebtoken";

export function autenticarToken(req, res, next) {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({ sucesso: false, erro: "Token não fornecido" });

  jwt.verify(token, process.env.SECRET, (err, usuario) => {
    if (err)
      return res.status(403).json({ sucesso: false, erro: "Token inválido" });

    req.usuario = usuario;
    next();
  });
}
