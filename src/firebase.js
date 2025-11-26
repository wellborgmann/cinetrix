import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, addDoc } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

// ---------------------------------------
// CONFIG DO .ENV
// ---------------------------------------
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// ---------------------------------------
// INICIAR FIREBASE CLIENT NO BACKEND
// ---------------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------
// ENVIAR MENSAGEM PARA TV
// ---------------------------------------
export async function cast(tvId, url, streaming) {
  try {
    await addDoc(
      collection(db, "tvs", tvId, "mensagens"),
      {
        url,
        streaming,
        hora: Date.now()
      }
    );

    return { ok: true };
  } catch (error) {
    console.error("Erro ao enviar cast:", error);
    return { ok: false, error };
  }
}

export { db };
