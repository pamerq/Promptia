import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const main = async () => {
  const out = [];
  for await (const m of await client.models.list()) {
    out.push(m.id);
  }
  // Imprime ordenado
  out.sort().forEach(id => console.log(id));
};
main().catch(e => {
  console.error(e?.response?.data ?? e);
  process.exit(1);
});
