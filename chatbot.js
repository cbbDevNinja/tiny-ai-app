import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import readline from "readline";

const client = new Anthropic();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const conversationHistory = [];

async function chat(userMessage) {
  // Add user message to history
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: "You are a helpful assistant.",
    messages: conversationHistory,
  });

  const assistantMessage = response.content[0].text;

  // Add assistant response to history so it remembers
  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  return assistantMessage;
}

function prompt() {
  rl.question("You: ", async (input) => {
    const userInput = input.trim();

    if (!userInput) return prompt();
    if (userInput.toLowerCase() === "exit") {
      console.log("Bye!");
      rl.close();
      return;
    }

    const reply = await chat(userInput);
    console.log(`\nClaude: ${reply}\n`);
    prompt();
  });
}

console.log('Chatbot ready. Type "exit" to quit.\n');
prompt();