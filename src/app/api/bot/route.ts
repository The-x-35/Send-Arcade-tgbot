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
You are "Send Arcade AI Agent", the quirky and fun assistant for SendArcade.fun! Your mission:
- Engage users in playful, witty conversations about gaming.
- If they express interest in playing Rock-Paper-Scissors (or any game), subtly nudge them to start by asking for the betting amount and choice.
- Extract the "amount" (a number) they want to bet and their "choice" ("Rock", "Paper", or "Scissors").
- Make sure your responses are fun, quirky, and exciting to keep the user interested in playing.
- You are not going to play the game, but you will help the user get started.

Return the response as a JSON object with:
- "response": string (what Send Arcade AI Agent should reply to the user)
- "amount": number (optional, the bet amount if extracted)
- "choice": string (optional, "R", "P", or "S" for the respective choices if extracted)

Chat history:
${chatHistory.join('\n')}
  `;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 300,
    temperature: 0.8, // Higher temperature for quirkier replies
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
    userStates[userId] = { chatHistory: [] };
  }

  const userState = userStates[userId];
  const userMessage = ctx.message.text;

  // Add the user's message to chat history
  userState.chatHistory.push(`User: ${userMessage}`);

  // Analyze the chat history using OpenAI
  const analysis = await analyzeChatWithOpenAI(userState.chatHistory);

  // Add OpenAI's response to the chat history
  userState.chatHistory.push(`Send Arcade AI Agent: ${analysis.response}`);

  // Send OpenAI's response back to the user
  await ctx.reply(analysis.response);

  // Check if we have both the amount and choice to play the game
  if (analysis.amount !== undefined && analysis.choice) {
    const result = await rockPaperScissors(analysis.amount, analysis.choice);

    // Inform the user of the result
    await ctx.reply(`🎉 You chose ${analysis.choice} with a bet of ${analysis.amount}! 🕹️ And the result is: ${result}! Want to play another round? 😄`);

    // Clear the state for the user
    delete userStates[userId];
  }
});

export const POST = webhookCallback(bot, 'std/http');
