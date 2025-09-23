// model-training/check-status.js
import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jobId = process.argv[2];

if (!jobId) {
  console.error("Uso: npm run ft:status -- <ftjob_id>");
  process.exit(1);
}

const STORE_PATH = process.env.FT_MODEL_STORE || ".ft-model"; // guardamos id de modelo entrenado

async function main() {
  const job = await client.fineTuning.jobs.retrieve(jobId);
  console.log(JSON.stringify(job, null, 2));

  if (job.fine_tuned_model) {
    console.log("Modelo entrenado listo:", job.fine_tuned_model);

    try {
      fs.writeFileSync(STORE_PATH, job.fine_tuned_model, "utf-8");
      console.log(`Guardado en ${STORE_PATH}`);
    } catch (e) {
      console.warn("No pude guardar el modelo:", e.message);
    }
  } else {
    console.log("Aun no termina. Vuelve a consultar más tarde.");
  }
}

main().catch(e => {
  console.error(e?.response?.data ?? e);
  process.exit(1);
});
