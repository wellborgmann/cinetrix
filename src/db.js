
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config(); 

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER ,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONN_LIMIT || "10", 10),
  queueLimit: 0,
  connectTimeout: 10000,

});


async function query(sql, params = []) {
  // pool.execute retorna [rows, fields]
  const [rows] = await pool.execute(sql, params);
  return rows;
}


const execute = query;

async function transaction(worker) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const api = {
      execute: (sql, params = []) => conn.execute(sql, params),
      query: (sql, params = []) => conn.execute(sql, params).then(([rows]) => rows),
      conn, // em caso de necessidade avançada
    };
    const result = await worker(api);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {

      console.error("Rollback error:", rollbackErr);
    }
    throw err;
  } finally {
    conn.release();
  }
}


async function closePool() {
  try {
    await pool.end(); // fecha todas as conexões
    console.log("DB pool closed.");
  } catch (err) {
    console.error("Error closing DB pool:", err);
  }
}


const signals = ["SIGINT", "SIGTERM", "SIGQUIT"];
signals.forEach((sig) =>
  process.on(sig, async () => {
    console.log(`Received ${sig}, closing DB pool...`);
    await closePool();
    // aguarda um pouco e mata o processo (evita hang)
    process.exit(0);
  })
);




// Export
export default {
  pool,        // uso avançado se necessário
  query,
  execute,
  transaction,
  closePool
};
