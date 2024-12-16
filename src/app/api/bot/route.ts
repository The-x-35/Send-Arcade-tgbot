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
const userStates: Record<string, { wantsToPlay?: boolean; amount?: number; choice?: "R" | "P" | "S" }> = {};

// OpenAI message analysis
async function analyzeChatWithOpenAI(chat: string): Promise<{ intent?: string; amount?: number; choice?: "R" | "P" | "S" }> {
  const prompt = `
Analyze the following user input for the intent to play Rock-Paper-Scissors:
1. If the user intends to play, return "intent": "play".
2. Extract the "amount" (a number) if specified.
3. Extract the "choice" ("R" for rock, "P" for paper, or "S" for scissors) if specified.
4. If no valid information is found, return an empty object.

User input: "${chat}"`;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 100,
    temperature: 0.7,
  });

  try {
    if (!response.choices[0].message.content) return {};
    return JSON.parse(response.choices[0].message.content.trim());
  } catch {
    return {};
  }
}

// Telegram bot handler
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const userState = userStates[userId] || {};

  // Analyze user input using OpenAI
  const analysis = await analyzeChatWithOpenAI(ctx.message.text);

  // Check for play intent
  if (!userState.wantsToPlay && analysis.intent === 'play') {
    userState.wantsToPlay = true;
    userStates[userId] = userState;
    await ctx.reply("Got it! Let's play Rock-Paper-Scissors. How much do you want to bet?");
    return;
  }

  // Extract the betting amount
  if (userState.wantsToPlay && !userState.amount && analysis.amount) {
    userState.amount = analysis.amount;
    userStates[userId] = userState;
    await ctx.reply("Got the amount you want to bet! Now, what's your choice Rock, Paper or Scissors?");
    return;
  }

  // Extract the choice
  if (userState.wantsToPlay && userState.amount && !userState.choice && analysis.choice) {
    userState.choice = analysis.choice;

    // Call the game function
    const result = await rockPaperScissors(userState.amount, userState.choice);

    // Respond with the result
    await ctx.reply(`You chose ${userState.choice} with a bet of ${userState.amount}. Result: ${result}`);

    // Clear the state
    delete userStates[userId];
    return;
  }

  // Generic responses if no clear intent or missing details
  if (!userState.wantsToPlay) {
    await ctx.reply("I'm here to help! Let me know if you'd like to play Rock-Paper-Scissors or ask me anything else.");
  } else if (!userState.amount) {
    await ctx.reply("Please specify the amount you'd like to bet.");
  } else if (!userState.choice) {
    await ctx.reply("Got the amount you want to bet! Now, what's your choice Rock, Paper or Scissors?");
  }
});

export const POST = webhookCallback(bot, 'std/http');
