import "dotenv/config";
import { Anthropic } from "@anthropic-ai/sdk";
import { ChromaClient } from "chromadb";
import fs from "fs";

const anthropic = new Anthropic();
const chroma = new ChromaClient({ path: "http://localhost:8000" });

// Split text into chunks
function chunkText(text, chunkSize = 200) {
  const words = text.split(" ");
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

// Generate embeddings using Anthropic... just kidding, we'll use Chroma's built-in
async function setupCollection(chunks) {
  // Delete collection if it exists so we start fresh
  try { await chroma.deleteCollection({ name: "documents" }); } catch {}

  const collection = await chroma.createCollection({
    name: "documents",
    embeddingFunction: {
      generate: async (texts) => {
        // Simple hash-based embedding for local dev (no embedding API needed)
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

  // Store chunks in Chroma
  await collection.add({
    documents: chunks,
    ids: chunks.map((_, i) => `chunk_${i}`),
  });

  console.log(`Stored ${chunks.length} chunks in Chroma\n`);
  return collection;
}

async function query(collection, question) {
  // Find most relevant chunks
  const results = await collection.query({
    queryTexts: [question],
    nResults: 2,
  });

  const context = results.documents[0].join("\n\n");

  // Send context + question to Claude
  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Answer the question based on this context:

${context}

Question: ${question}`,
      },
    ],
  });

  return response.content[0].text;
}

// Main
const text = fs.readFileSync("document.txt", "utf-8");
const chunks = chunkText(text, 50);
const collection = await setupCollection(chunks);

const question = "What is RAG and how does it work?";
console.log(`Question: ${question}\n`);
const answer = await query(collection, question);
console.log(`Answer: ${answer}`);