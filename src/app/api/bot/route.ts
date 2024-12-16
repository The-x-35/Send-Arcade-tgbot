export const dynamic = 'force-dynamic';

export const fetchCache = 'force-no-store';

import { Bot, webhookCallback } from 'grammy';
import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { rps } from '../../tools/rps';
import OpenAI from 'openai';

// Initialize with private key and optional RPC URL
const agent = new SolanaAgentKit(
  process.env.WALLET || 'your-wallet',
  'https://api.devnet.solana.com',
  process.env.OPENAI_API_KEY || 'key'
);

// Create LangChain tools
const tools = createSolanaTools(agent);

async function rockPaperScissors(amount: number, choice: "R" | "P" | "S") {
  return rps(agent, amount, choice);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN environment variable not found.');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'key' });

const bot = new Bot(token);

// User state to track ongoing conversations
const userStates: Record<string, { chatHistory: string[] }> = {};

// OpenAI message analysis
async function analyzeChatWithOpenAI(chatHistory: string[]): Promise<{ response: string; amount?: number; choice?: "R" | "P" | "S" }> {
  const prompt = `
You are an assistant helping with general conversations. If the user indicates they want to play Rock-Paper-Scissors:
1. Extract the "amount" (a number) they want to bet.
2. Extract the "choice" ("R", "P", or "S").
3. Provide a response to continue the conversation naturally.
Return the response as a JSON object with:
- "response": string (what the bot should reply to the user)
- "amount": number (optional, the bet amount if extracted)
- "choice": string (optional, "R", "P", or "S" if extracted)
Chat history:
${chatHistory.join('\n')}
  `;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
  });

  try {
    if (!response.choices[0].message.content) {
      return { response: "I'm not sure how to respond to that." };
    }
    return JSON.parse(response.choices[0].message.content.trim());
  } catch {
    return { response: "Sorry, I couldn't process your request. Can you clarify?" };
  }
}

// Telegram bot handler
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  // Initialize user state if not already present
  if (!userStates[userId]) {
    userStates[userId] = { chatHistory: [] };
  }

  const userState = userStates[userId];
  const userMessage = ctx.message.text;

  // Add the user's message to chat history
  userState.chatHistory.push(`User: ${userMessage}`);

  // Analyze the chat history using OpenAI
  const analysis = await analyzeChatWithOpenAI(userState.chatHistory);

  // Add OpenAI's response to the chat history
  userState.chatHistory.push(`Assistant: ${analysis.response}`);

  // Send OpenAI's response back to the user
  await ctx.reply(analysis.response);

  // Check if we have both the amount and choice to play the game
  if (analysis.amount !== undefined && analysis.choice) {
    const result = await rockPaperScissors(analysis.amount, analysis.choice);

    // Inform the user of the result
    await ctx.reply(`You chose ${analysis.choice} with a bet of ${analysis.amount}. Result: ${result}`);

    // Clear the state for the user
    delete userStates[userId];
  }
});

export const POST = webhookCallback(bot, 'std/http');
