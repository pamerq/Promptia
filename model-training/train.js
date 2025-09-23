import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Config desde .env
const DATASET_PATH = process.env.FT_DATASET_PATH || "data/bubu_train.jsonl";
const BASE_MODEL   = process.env.FT_BASE_MODEL   || "gpt-4.1-nano-2025-04-14";

async function main() {
  try {
    if (!fs.existsSync(DATASET_PATH)) {
      throw new Error(`No encuentro el dataset en ${DATASET_PATH}`);
    }

    console.log(`[upload] subiendo ${DATASET_PATH} ...`);
    const file = await client.files.create({
      file: fs.createReadStream(DATASET_PATH),
      purpose: "fine-tune",
    });
    console.log("[upload] file.id:", file.id);

    console.log(`[fine-tune] lanzando job con base ${BASE_MODEL} ...`);
    const job = await client.fineTuning.jobs.create({
      training_file: file.id,
      model: BASE_MODEL,
    });
    console.log("[job] id:", job.id, "| status:", job.status);

    console.log("\n👉 Consulta estado con:");
    console.log("npm run ft:status --", job.id);
  } catch (err) {
    console.error("[train] error:", err?.response?.data ?? err.message ?? err);
    process.exit(1);
  }
}

main();
