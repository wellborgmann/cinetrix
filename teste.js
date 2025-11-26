import fs from "fs";
import path from "path";

(async()=>{
    const JSON_FILE = path.resolve("./lista.json");
   const data = fs.readFileSync(JSON_FILE, "utf-8");
         const midias = JSON.parse(data);
         console.log(midias.movies[100]);
})();