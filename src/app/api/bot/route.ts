export const dynamic = 'force-dynamic'

export const fetchCache = 'force-no-store'

import { Bot, webhookCallback } from 'grammy';
import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { rps } from '../../tools/rps';

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

const bot = new Bot(token);

// Store user interaction states
const userStates: Record<string, { amount?: number; choice?: "R" | "P" | "S" }> = {};

bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const userState = userStates[userId] || {};

  // Step 1: Ask for the betting amount
  if (!userState.amount) {
    const amount = parseFloat(ctx.message.text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("Please enter a valid betting amount (e.g., 0.1).");
      return;
    }
    userState.amount = amount;
    userStates[userId] = userState;
    await ctx.reply("What is your choice? (R for Rock, P for Paper, S for Scissors)");
    return;
  }

  // Step 2: Ask for the user's choice
  if (!userState.choice) {
    const choice = ctx.message.text.toUpperCase();
    if (!["R", "P", "S"].includes(choice)) {
      await ctx.reply("Invalid choice. Please choose R (Rock), P (Paper), or S (Scissors).");
      return;
    }
    userState.choice = choice as "R" | "P" | "S";

    // Call the rockPaperScissors function
    const result = await rockPaperScissors(userState.amount, userState.choice);

    // Send the result to the user
    await ctx.reply(`You chose ${choice} with a bet of ${userState.amount}. Result: ${result}`);

    // Clear the state for the user
    delete userStates[userId];
    return;
  }
});

export const POST = webhookCallback(bot, 'std/http');
