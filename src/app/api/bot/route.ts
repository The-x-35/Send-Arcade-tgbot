export const dynamic = 'force-dynamic'

export const fetchCache = 'force-no-store'

import { Bot, webhookCallback } from 'grammy'
import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { rps } from '../../tools/rps';

// Initialize with private key and optional RPC URL
const agent = new SolanaAgentKit(
  process.env.WALLET||'your-wallet',
  'https://api.devnet.solana.com',
  process.env.OPENAI_API_KEY||'key'
);

// Create LangChain tools
const tools = createSolanaTools(agent);
async function rockPaperScissors(amount: number, choice: "R" | "P" | "S") {
    return rps(agent, amount, choice);
  }
const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) throw new Error('TELEGRAM_BOT_TOKEN environment variable not found.')

const bot = new Bot(token)
bot.on('message:text', async (ctx) => {
  let ans = await rockPaperScissors(0.0001,"R");
  await ctx.reply(ans);
})

export const POST = webhookCallback(bot, 'std/http')