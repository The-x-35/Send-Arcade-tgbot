import { Connection, sendAndConfirmTransaction, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";
import fetch from "node-fetch"; // Ensure compatibility in Node.js
import dotenv from "dotenv";
dotenv.config();
export async function rps(
    agent: SolanaAgentKit,
    amount: number,
    choice: "rock" | "paper" | "scissors",
): Promise<string> {
    try {
        const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);
        const KEYPAIR = agent.wallet;
        const ADDRESS = KEYPAIR.publicKey;
        const PRIVATE_KEY = KEYPAIR.secretKey;
        const res = await fetch(
            `https://rps.sendarcade.fun/api/actions/bot?amount=${amount}&choice=${choice}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    account: ADDRESS.toBase58(),
                }),
            },
        );

        const data = await res.json();
        console.log(data);
        if (data.transaction) {
            console.log(data.message);
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));

            // Sign and send transaction
            txn.sign(KEYPAIR);
            const signature = await sendAndConfirmTransaction(connection, txn, [KEYPAIR]);

            return signature;
        } else {
            return "failed";
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS game failed: ${error.message}`);
    }
}