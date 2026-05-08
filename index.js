import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "REMOVED", // replace with your key
});

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "Explain what a RAG app is in 2 sentences.",
    },
  ],
});

console.log(response.content[0].text);