// app/api/route.ts (server)
import { NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  HF_TOKEN,
} = process.env;

if (!HF_TOKEN) {
  console.warn("HF_TOKEN is not set in env");
}

if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRA_DB_ENDPOINT || !ASTRA_DB_COLLECTION) {
  console.warn("Astra DB environment variables are missing");
}

const hf = new HfInference(HF_TOKEN);
const astraClient = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN ?? "");
// create db handle (matches your LoadDb script usage)
const db = astraClient.db(ASTRA_DB_ENDPOINT ?? "", { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const latestMessage = messages.length ? messages[messages.length - 1].content : "";

    // create embedding for latest message
    const embeddingRes = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      input: latestMessage,
    });

    const vector = embeddingRes?.data?.[0]?.embedding;
    if (!vector || !Array.isArray(vector)) {
      return NextResponse.json({ answer: "Failed to create embedding." }, { status: 500 });
    }

    // Query Astra DB collection for nearest neighbors
    const collection = await db.collection(ASTRA_DB_COLLECTION as string);
    // The exact query shape depends on Astra SDK; below is a general example using find with vector search.
    // Adjust fields to match how you stored documents (e.g., content or text).
    const k = 8;
    const cursor = await collection.find({
      $vector: {
        $vector: vector,
        $limit: k,
      },
    });

    const docs = await cursor.toArray();
    const docText = docs.map((d: any) => d.content ?? d.text ?? "").join("\n---\n");

    const systemPrompt = `
You are an AI assistant with knowledge of the Ethiopian Premier League.
Use the context below (recent pages & scraped docs) to answer the QUESTION.
Context:
${docText}

QUESTION:
${latestMessage}
    `;

    // Ask HF text-generation endpoint to produce an answer.
    // NOTE: The HfInference SDK has multiple methods. If you prefer chatCompletion, adapt accordingly.
    const gen = await hf.textGeneration.create({
      model = "deepseek-ai/DeepSeek-V2.5", // replace with a chat-ready model you have access to on HF (this is an example)
      inputs: systemPrompt,
      max_new_tokens: 256,
    });

    const answer = Array.isArray(gen) ? gen[0]?.generated_text ?? "" : (gen as any)?.generated_text ?? "";

    return NextResponse.json({ answer });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
