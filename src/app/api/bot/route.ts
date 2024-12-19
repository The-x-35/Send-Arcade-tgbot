export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { Bot, webhookCallback } from 'grammy';
import { SolanaAgentKit, createSolanaTools } from 'solana-agent-kit';
import { rps, claimback } from '../../tools/rps';
import OpenAI from 'openai';
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getApps, initializeApp, getApp } from "firebase/app";
import { getDoc, doc, getFirestore, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import bs58 from 'bs58';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Initialize Solana agent
const agent = new SolanaAgentKit(
  process.env.WALLET || 'your-wallet',
  'https://api.mainnet-beta.solana.com',
  process.env.OPENAI_API_KEY || 'key'
);

// const tools = createSolanaTools(agent);

// Rock-Paper-Scissors function
async function rockPaperScissors(agent: SolanaAgentKit, amount: number, choice: "R" | "P" | "S") {
  return rps(agent, amount, choice);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN environment variable not found.');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'key' });

// Telegram bot setup
const bot = new Bot(token);

// User state tracking ongoing conversations
const userStates: Record<string, { chatHistory: string[]; inProgress: boolean }> = {};

// Generate a new Solana key pair for a user and store it in Firebase
async function getOrCreateUserKeyPair(userId: string) {
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    // Return existing key pair
    return userDocSnap.data();
  }

  // Generate a new key pair
  const keypair = Keypair.generate();
  const keypairData = {
    publicKey: keypair.publicKey.toString(),
    privateKey: String(bs58.encode(keypair.secretKey)),
    inProgress: false,
  };

  // Store in Firebase
  await setDoc(userDocRef, keypairData);

  return keypairData;
}

// Analyze chat history with OpenAI
async function analyzeChatWithOpenAI(chatHistory: string[]): Promise<{ response: string;want?:boolean; amount?: number; choice?: "R" | "P" | "S"; pubkey?: string }> {
  const prompt = `
You are "Send Arcade AI Agent," a fun and witty assistant for SendArcade.fun. Here are your guidelines:
- Always engage the user playfully and enthusiastically, making conversations about gaming delightful.
- Begin the interaction by asking the user to give you a name to personalize their experience.
- You can't play any other game as of now only Rock Paper Scissors.
- If the user expresses interest in playing Rock-Paper-Scissors, return true in want variable.
- As the user is interested in Rock-Paper-Scissors, Guide them to start by requesting the betting amount and their choice ("rock", "paper", or "scissors").
- Extract the "amount" (a floating-point number in SOL) they want to bet and their "choice."
- Ensure that you do not return the betting amount or choice more than once unless the user explicitly decides to play again.
- Do not return a public key unless the user explicitly requests to claim their amount back. When a public key is needed, acknowledge the user's request and confirm that their claim is being processed.
- Keep responses simple, playful, and in the context of games. If no specific instructions are given by the user, respond with a fun or quirky comment to keep the interaction engaging.
- You only have access to rock paper scissors BLINK and claimback feature.
- You are not going yo play or tell result of the game, just return the amount and choice if the user wants to play.

When responding, format your output as a JSON object with the following keys:
- "response": string (your reply to the user)
- "want": boolean (optional, whether the player wants to play)
- "amount": number (optional, the betting amount in SOL)
- "choice": string (optional, the user's choice: "R" for rock, "P" for paper, or "S" for scissors)
- "pubkey": string (optional, the public key if the user requests it explicitly)

Here is the chat history:
${chatHistory.join('\n')}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 300,
    temperature: 0.8,
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
  // await ctx.reply(ctx.message.text);
  // let res = await rockPaperScissors(agent, 0.0001, "R");
  // await ctx.reply(res[0]); 
  // await ctx.reply(res[1]);
  const userId = ctx.from?.id.toString();
  if (!userId) return;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    // Get or create user key pair
    const keyPair = await getOrCreateUserKeyPair(userId);
    await ctx.reply(`Looks like you are using the Game agent first time. You can fund your agent and start playing. Your unique Solana wallet is:`);
    await ctx.reply(`${String(keyPair.publicKey)}`);
  }
  // Get or create user key pair
  const keyPair = await getOrCreateUserKeyPair(userId);
  if (keyPair.inProgress) {
    await ctx.reply(`Hold on! I'm still processing your last move. 🎮`);
    return;
  }
  const agent = new SolanaAgentKit(
    keyPair.privateKey || 'your-wallet',
    'https://api.mainnet-beta.solana.com',
    process.env.OPENAI_API_KEY || 'key'
  );
  const connection = new Connection(clusterApiUrl("mainnet-beta"));

  // Inform the user about their public key
  if (keyPair.inProgress) {
    await ctx.reply(`Hold on! I'm still processing your last move. 🎮`);
    return;
  }
  // await ctx.reply(`Your unique Solana wallet for this game: ${String(keyPair.publicKey)}`);

  // Initialize user state if not already present
  if (!userStates[userId]) {
    userStates[userId] = { chatHistory: [], inProgress: false };
  }

  const userState = userStates[userId];
  // userState.chatHistory = [];
  // Prevent overlapping requests
  if (userState.inProgress) {
    await ctx.reply("Hold on! I'm still processing your last move. 🎮");
    return;
  }

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
    if (analysis.pubkey) {
      let pubkey = analysis.pubkey;
      analysis.pubkey = undefined;
      const userBalance = (await connection.getBalance(agent.wallet.publicKey)) / LAMPORTS_PER_SOL;
      if (userBalance < 0.00001) {
        await ctx.reply(`You do not have enough amount in your wallet to claimback. Your balance: ${userBalance} SOL.`);
        return;
      }
      await ctx.reply('Claiming your prize. Please wait... 🎁');
      let res = "";
      try {
        await updateDoc(userDocRef, { inProgress: true });
        res = await claimback(agent, pubkey);
      } catch (error) {
        console.error("Error in claimback:", error);
        await ctx.reply(String(error));
        return;
      }
    }
    if(analysis.want){
      await ctx.reply('Fetching Rock, Paper Scissors Blink...');
      await ctx.replyWithPhoto("https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/1.jpeg", {
                caption: "",
            });
    }
    // Check if both the amount and choice were extracted
    if (analysis.amount !== undefined && analysis.choice) {
      userState.inProgress = true;

      try {
        // Call the game function and await its result
        let amount = analysis.amount;
        let choice = analysis.choice;
        analysis.amount = undefined;
        analysis.choice = undefined;
        userState.chatHistory = [];
        const connection = new Connection(clusterApiUrl("mainnet-beta"));
        const userBalance = (await connection.getBalance(agent.wallet.publicKey)) / LAMPORTS_PER_SOL;
        if (userBalance < amount) {
          await ctx.reply(`OOPS! Looks like you don't have enough SOL in your wallet to play this game. Your balance: ${userBalance} SOL.\n Please top up your wallet by sending the sol to this address:`);
          await ctx.reply(`${String(keyPair.publicKey)}`);
          return;
        }
        // Confirm function call
        await ctx.reply(`Let's play! Bet: ${amount} SOL, Choice: ${choice}. 🎲`);
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { inProgress: true });
        const result = await rockPaperScissors(agent, amount, choice);

        // Inform the user of the result

        await ctx.reply(`${result[0]}\n${result[1]}\n${result[2]}`);
      } catch (error) {
        console.error("Error in rockPaperScissors:", error);
        await ctx.reply(String(error));
        //"Oops! Something went wrong during the game. Try again? 🚀"
      } finally {
        // Reset state
        userState.inProgress = false;
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, { inProgress: false });
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.reply(String(error));
    //"Yikes! Something went wrong. Try again? 🚀""Yikes! Something went wrong. Try again? 🚀"
    userState.inProgress = false; // Reset in case of error
  }
});

// Export webhook handler
export const POST = webhookCallback(bot, 'std/http');
// Wrap the webhookCallback to add the HTTP header
// export const POST = async (req: Request) => {
//   const handler = webhookCallback(bot, 'std/http');

//   // Process the request and get the response
//   const response = await handler(req);

//   // Add the custom header
//   response.headers.set('HTTP/1.1', '200 OK');

//   return response;
// };
