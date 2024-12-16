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
const userStates: Record<string, { amount?: number; choice?: "R" | "P" | "S"; wantsToPlay?: boolean }> = {};

async function analyzeChatWithOpenAI(chat: string): Promise<{ wantsToPlay?: boolean; amount?: number; choice?: "R" | "P" | "S" }> {
  const prompt = `
Analyze the following user input and determine:
1. Whether the user wants to play Rock-Paper-Scissors. Return "wantsToPlay": true if they do, or leave it out otherwise.
2. Extract the betting "amount" (a number) if specified.
3. Extract the "choice" ("R", "P", or "S") if specified.
Return the response as a JSON object with "wantsToPlay" (boolean), "amount" (number), and "choice" ("R", "P", or "S") keys.
If no valid information is found, return an empty object.

User input: "${chat}"`;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 100,
    temperature: 0.7
  });

  try {
    if (!response.choices[0].message.content) return {};
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

  // Step 1: Check if the user wants to play Rock-Paper-Scissors
  if (!userState.wantsToPlay && analysis.wantsToPlay) {
    userState.wantsToPlay = true;
    userStates[userId] = userState;
    await ctx.reply("Great! How much do you want to bet?");
    return;
  }

  // Step 2: Extract the betting amount
  if (userState.wantsToPlay && !userState.amount && analysis.amount) {
    userState.amount = analysis.amount;
    userStates[userId] = userState;
    await ctx.reply("Got the amount you want to bet! Now, what's your choice Rock, Paper or Scissors?");
    return;
  }

  // Step 3: Extract the choice
  if (userState.wantsToPlay && !userState.choice && analysis.choice) {
    userState.choice = analysis.choice;

    // Call the rockPaperScissors function
    const result = await rockPaperScissors(userState.amount || 0, userState.choice);

    // Send the result to the user
    await ctx.reply(`You chose ${userState.choice} with a bet of ${userState.amount}. Result: ${result}`);

    // Clear the state for the user
    delete userStates[userId];
    return;
  }

  // Generic fallback or prompt for additional details
  if (!userState.wantsToPlay) {
    await ctx.reply("I'm here to assist! Let me know if you'd like to play Rock-Paper-Scissors or need help with something else.");
  } else if (!userState.amount) {
    await ctx.reply("Please specify the amount you want to bet.");
  } else if (!userState.choice) {
    await ctx.reply("Got the amount you want to bet! Now, what's your choice Rock, Paper or Scissors?");
  }
});

export const POST = webhookCallback(bot, 'std/http');
