import "dotenv/config";
import express from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import { ChromaClient } from "chromadb";
import fs from "fs";

const app = express();
app.use(express.json());

const anthropic = new Anthropic();
const chroma = new ChromaClient({
  ssl: true,
  host: "api.trychroma.com",
  port: 8000,
  headers: {
    "x-chroma-token": process.env.CHROMA_API_KEY,
  },
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE,
});
function chunkText(text, chunkSize = 50) {
  const words = text.split(" ");
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

async function setupCollection() {
  try { await chroma.deleteCollection({ name: "documents" }); } catch {}

  const collection = await chroma.createCollection({
    name: "documents",
    embeddingFunction: {
      generate: async (texts) => {
        return texts.map(text => {
          const vec = new Array(384).fill(0);
          for (let i = 0; i < text.length; i++) {
            vec[i % 384] += text.charCodeAt(i);
          }
          const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
          return vec.map(v => v / magnitude);
        });
      }
    }
  });

  const text = fs.readFileSync("document.txt", "utf-8");
  const chunks = chunkText(text);

  await collection.add({
    documents: chunks,
    ids: chunks.map((_, i) => `chunk_${i}`),
  });

  console.log(`Stored ${chunks.length} chunks in Chroma`);
  return collection;
}

// Health check
app.get("/", (req, res) => {
  res.json({ status: "RAG server is running" });
});

// Query endpoint
app.post("/ask", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  const results = await collection.query({
    queryTexts: [question],
    nResults: 2,
  });

  const context = results.documents[0].join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Answer the question based on this context:\n\n${context}\n\nQuestion: ${question}`,
      },
    ],
  });

  res.json({ answer: response.content[0].text });
});

const collection = await setupCollection();

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});