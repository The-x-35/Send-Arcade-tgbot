export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { Bot, webhookCallback } from 'grammy';
import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { rps } from '../../tools/rps';
import OpenAI from 'openai';

// Initialize Solana agent
const agent = new SolanaAgentKit(
  process.env.WALLET || 'your-wallet',
  'https://api.mainnet-beta.solana.com',
  process.env.OPENAI_API_KEY || 'key'
);

const tools = createSolanaTools(agent);

// Rock-Paper-Scissors function
async function rockPaperScissors(amount: number, choice: "rock" | "paper" | "scissors") {
  return rps(agent, amount, choice);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN environment variable not found.');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'key' });

const bot = new Bot(token);

// User state tracking ongoing conversations
const userStates: Record<string, { chatHistory: string[]; inProgress: boolean }> = {};

// Analyze chat history with OpenAI
async function analyzeChatWithOpenAI(chatHistory: string[]): Promise<{ response: string; amount?: number; choice?: "rock" | "paper" | "scissors" }> {
  const prompt = `
You are "Send Arcade AI Agent", a quirky and fun assistant for SendArcade.fun! Your mission:
- Engage users with playful, witty conversations about gaming.
- If they express interest in playing Rock-Paper-Scissors (or any game), subtly nudge them to start by asking for the betting amount and choice.
- Extract the "amount" (a floating-point number in SOL) they want to bet and their "choice" ("rock", "paper", or "scissors").
- Make your replies fun, exciting, and game-like to keep the user engaged.

Return a JSON object with:
- "response": string (your reply to the user)
- "amount": number (optional, extracted bet amount)
- "choice": string (optional, extracted choice: "rock", "paper", or "scissors").

Chat history:
${chatHistory.join('\n')}
  `;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 300,
    temperature: 0.8, // Quirky and fun responses
  });

  try {
    if (!response.choices[0].message.content) {
      return { response: "Oops, my joystick slipped! Can you repeat that?" };
    }
    return JSON.parse(response.choices[0].message.content.trim());
  } catch {
    return { response: "Woah, I got stuck in a game loop. Can you say that again?" };
  }
}

// Telegram bot handler
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  // Initialize user state if not already present
  if (!userStates[userId]) {
    userStates[userId] = { chatHistory: [], inProgress: false };
  }

  const userState = userStates[userId];

  // Prevent overlapping requests
  if (userState.inProgress) {
    await ctx.reply("Hold on! I'm still processing your last move. 🎮");
    return;
  }

  // Mark processing as in progress
  userState.inProgress = true;

  // Get the user message and add it to the chat history
  const userMessage = ctx.message.text;
  userState.chatHistory.push(`User: ${userMessage}`);

  try {
    // Analyze the chat history
    const analysis = await analyzeChatWithOpenAI(userState.chatHistory);

    // Add OpenAI's response to the chat history
    userState.chatHistory.push(`Send Arcade AI Agent: ${analysis.response}`);

    // Send the response to the user
    await ctx.reply(analysis.response);

    // Check if both the amount and choice were extracted
    if (analysis.amount !== undefined && analysis.choice) {
      // Confirm function call
      await ctx.reply(`Let's play! Bet: ${analysis.amount} SOL, Choice: ${analysis.choice}. 🎲`);
      
      // Call the game function and await its result
      const result = await rockPaperScissors(analysis.amount, analysis.choice);

      // Inform the user of the result
      await ctx.reply(`🎉 You chose ${analysis.choice} with a bet of ${analysis.amount}! 🕹️ And the result is: ${result}! Want to play another round? 😄`);
        analysis.amount = undefined;
        analysis.choice = undefined;
      // Clear chat history for a fresh start
      userState.chatHistory = [];
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.reply("Yikes! Something went wrong. Try again? 🚀");
  } finally {
    // Mark processing as complete
    userState.inProgress = false;
  }
});

export const POST = webhookCallback(bot, 'std/http');
