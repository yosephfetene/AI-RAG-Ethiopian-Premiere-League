import { NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";
import { DataAPIClient } from "@datastax/astra-db-ts";

interface AstraDocument {
  content: string;
  vector: number[];
  _id?: any;
}

interface ChatMessage {
  content: string;
  role: "user" | "assistant";
}

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  HF_TOKEN,
} = process.env;

// Validate env vars
if (!HF_TOKEN) console.error("❌ Missing HF_TOKEN");
if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRA_DB_ENDPOINT || !ASTRA_DB_COLLECTION)
  console.error("❌ Missing Astra DB environment variables");

const hf = new HfInference(HF_TOKEN);
const astraClient = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = astraClient.db(ASTRA_DB_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const extractVectorFromResponse = (response: any): number[] => {
  if (Array.isArray(response)) {
    if (Array.isArray(response[0])) return response[0];
    return response;
  }

  if (response && typeof response === "object") {
    const data = response.data ?? Object.values(response).find((v) => Array.isArray(v));
    if (Array.isArray(data)) {
      if (Array.isArray(data[0])) return data[0];
      return data;
    }
  }

  throw new Error("Unexpected embedding format from HF API");
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    const latestMessage = messages.at(-1)?.content?.trim();

    if (!latestMessage) {
      return NextResponse.json({ answer: "No message provided." }, { status: 400 });
    }

    // 🔹 Create embedding for user message
    const embeddingRes = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: latestMessage,
    });

    const vector = extractVectorFromResponse(embeddingRes);
    const VECTOR_DIM = 384;
    const safeVector =
      vector.length >= VECTOR_DIM
        ? vector.slice(0, VECTOR_DIM)
        : [...vector, ...Array(VECTOR_DIM - vector.length).fill(0)];

    // 🔹 Query Astra DB
    const collection = await db.collection<AstraDocument>(ASTRA_DB_COLLECTION);
    const docs = await collection
      .find({}, { sort: { $vector: safeVector }, limit: 5, includeSimilarity: true })
      .toArray();

    const context =
      docs.length > 0
        ? docs.map((d) => d.content).join("\n---\n")
        : "No relevant information found in the database.";

    // 🔹 Construct prompt
    const systemPrompt = `You are an expert AI assistant specializing in Ethiopian Premier League football.
Use the following CONTEXT to answer the QUESTION accurately.

CONTEXT:
${context}

QUESTION: ${latestMessage}

If the context doesn't help, say "I don’t have specific info in my database, but generally..." and give a helpful general answer.`;

    // 🔹 Generate response
    const genResponse = await hf.textGeneration({
      model: "HuggingFaceH4/zephyr-7b-beta",
      inputs: systemPrompt,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.4,
        do_sample: true,
      },
    });

    const answer =
      genResponse?.generated_text?.trim() ||
      "I couldn’t generate a response. Please try again.";

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("❌ Chat API Error:", err);

    if (err.message?.includes("Resuming your database")) {
      return NextResponse.json(
        { answer: "The database is resuming. Please wait and try again." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { answer: "An internal error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
