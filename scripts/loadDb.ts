// scripts/loadDb.ts
import { DataAPIClient } from "@datastax/astra-db-ts";
import { PlaywrightWebBaseLoader } from "@langchain/community/document_loaders/web/playwright";
import { HfInference } from "@huggingface/inference";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import "dotenv/config";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  HF_TOKEN,
} = process.env;

if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRA_DB_ENDPOINT || !ASTRA_DB_COLLECTION) {
  console.warn("Missing Astra DB environment variables.");
}

const hf = new HfInference(HF_TOKEN);
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN ?? "");
const db = client.db(ASTRA_DB_ENDPOINT ?? "", { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const eplUrls = [
  "https://en.wikipedia.org/wiki/Ethiopian_Premier_League",
  "https://www.transfermarkt.com/ethiopian-premier-league/startseite/wettbewerb/ETP1",
  "https://soccerleagues.fandom.com/wiki/Ethiopian_Premier_League",
  "https://en.wikipedia.org/wiki/Ethiopian_Premier_League#Top_goalscorer_by_season",
  "https://en.wikipedia.org/wiki/Ethiopian_Premier_League#All-Time_Single_Season_Top_Goal_Scorers",
];

const MAX_PAGES = Number(process.env.SEED_MAX_PAGES ?? 2);
const MAX_CHUNKS_PER_PAGE = Number(process.env.SEED_MAX_CHUNKS_PER_PAGE ?? 20);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getErrMsg = (e: unknown) => {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
    return (e as any).message;
  }
  return String(e);
};

async function retryOp<T>(op: () => Promise<T>, attempts = 3, initialDelay = 1000): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await op();
    } catch (err: unknown) {
      const msg = getErrMsg(err);
      if (attempt >= attempts) {
        throw err;
      }
      const delay = initialDelay * attempt;
      console.warn(`Operation failed (attempt ${attempt}): ${msg}. Retrying in ${delay}ms`);
      await sleep(delay);
      attempt++;
    }
  }
}

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
  const maxAttempts = 3;
  const perRequestTimeout = 120000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await db.createCollection(ASTRA_DB_COLLECTION as string, {
        vector: {
          dimension: 1536,
          metric: similarityMetric,
        },
        maxTimeMS: perRequestTimeout,
      });
      console.log("createCollection result:", res);
      return res;
    } catch (err: unknown) {
      const msg = getErrMsg(err);
      const isTimeout = msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout");
      console.warn(`createCollection attempt ${attempt} failed: ${msg}`);
      if (isTimeout && attempt < maxAttempts) {
        const backoff = attempt * 2000;
        console.log(`Retrying createCollection in ${backoff}ms (attempt ${attempt + 1}/${maxAttempts})`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
};

const scrapePage = async (url: string) => {
  const loader = new PlaywrightWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerText);
      await browser.close();
      return result;
    },
  });

  const scraped = await loader.scrape(); // returns string
  return (scraped ?? "").replace(/<[^>]*>?/gm, "|");
};

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION as string);
  let pagesProcessed = 0;
  let totalInserted = 0;

  for (const url of eplUrls) {
    if (MAX_PAGES && pagesProcessed >= MAX_PAGES) break;
    console.log(`Processing page: ${url}`);
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);

    let chunksProcessed = 0;
    for (const chunk of chunks) {
      if (MAX_CHUNKS_PER_PAGE && chunksProcessed >= MAX_CHUNKS_PER_PAGE) break;

      const response = await retryOp(
        () =>
          hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: chunk,
          }),
        3,
        2000
      );

      // featureExtraction may return array or nested shape; try to normalize to 1D array
      let vector: number[] = [];
      if (Array.isArray(response)) {
        // if response[0] is array of floats:
        vector = Array.isArray(response[0]) ? (response[0] as number[]) : (response as unknown as number[]);
      } else if ((response as any).data) {
        vector = (response as any).data[0];
      } else {
        vector = response as unknown as number[];
      }

      const VECTOR_DIM = 1536;
      const safeVector =
        vector.length >= VECTOR_DIM
          ? vector.slice(0, VECTOR_DIM)
          : vector.concat(new Array(VECTOR_DIM - vector.length).fill(0));

      await retryOp(
        () =>
          collection.insertOne({
            content: chunk,
            vector: safeVector,
          }),
        3,
        1000
      );

      chunksProcessed++;
      totalInserted++;
      if (totalInserted % 10 === 0) console.log(`Inserted ${totalInserted} documents so far`);
    }

    pagesProcessed++;
  }

  console.log(`Seeding complete. Pages processed: ${pagesProcessed}, documents inserted: ${totalInserted}`);
};

(async () => {
  try {
    await createCollection();
  } catch (err: unknown) {
    if ((err as any)?.name === "CollectionAlreadyExistsError") {
      console.log("Collection already exists, continuing to load data...");
    } else {
      console.error("createCollection failed:", err);
      throw err;
    }
  }

  await loadSampleData();
})();
