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

// Store user interaction states
const userStates: Record<string, { amount?: number; choice?: "R" | "P" | "S" }> = {};

async function analyzeChatWithOpenAI(chat: string): Promise<{ amount?: number; choice?: "R" | "P" | "S" }> {
  const prompt = `
Extract the betting amount and choice for Rock-Paper-Scissors from the following chat:
Chat: "${chat}"
Return the response as a JSON object with "amount" (number) and "choice" ("R", "P", or "S") keys.
If no valid information is found, return an empty object.
  `;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 50,
    temperature: 0.7
  });

  try {
    if(!response.choices[0].message.content) return {};
    return JSON.parse(response.choices[0].message.content.trim());
  } catch {
    return {};
  }
}

bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const userState = userStates[userId] || {};

  // Analyze the chat input with OpenAI
  const analysis = await analyzeChatWithOpenAI(ctx.message.text);

  // Step 1: Extract betting amount
  if (!userState.amount && analysis.amount) {
    userState.amount = analysis.amount;
    userStates[userId] = userState;
    await ctx.reply("Got your amount! Now, what's your choice? (R for Rock, P for Paper, S for Scissors)");
    return;
  }

  // Step 2: Extract choice
  if (!userState.choice && analysis.choice) {
    userState.choice = analysis.choice;

    // Call the rockPaperScissors function
    const result = await rockPaperScissors(userState.amount || 0, userState.choice);

    // Send the result to the user
    await ctx.reply(`You chose ${userState.choice} with a bet of ${userState.amount}. Result: ${result}`);

    // Clear the state for the user
    delete userStates[userId];
    return;
  }

  // If no valid information is extracted, ask again
  if (!userState.amount) {
    await ctx.reply("Please specify the amount you want to bet.");
  } else if (!userState.choice) {
    await ctx.reply("Please specify your choice: R for Rock, P for Paper, S for Scissors.");
  }
});

export const POST = webhookCallback(bot, 'std/http');
