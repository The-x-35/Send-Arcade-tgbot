import { clusterApiUrl, Connection, Keypair, sendAndConfirmTransaction, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";
import fetch from "node-fetch"; // Ensure compatibility in Node.js
import bs58 from "bs58";
import dotenv from "dotenv";
dotenv.config();
export async function rps(
    agent: SolanaAgentKit,
    amount: number,
    choice: "rock" | "paper" | "scissors",
) {
    try {
        const connection = new Connection(clusterApiUrl("devnet"));
        const KEYPAIR = agent.wallet;
        const ADDRESS = KEYPAIR.publicKey;
        const PRIVATE_KEY = KEYPAIR.secretKey;
        const res = await fetch(
            `https://rps-solana-blinks.vercel.app/api/actions/backend?amount=${amount}&choice=${choice}&player=${"B"}`,
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
        const msg = data.message;
        if (data.transaction) {
            console.log(data.message);
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));

            // Sign and send transaction
            txn.sign(KEYPAIR);
            sendAndConfirmTransaction(connection, txn, [KEYPAIR]);
            // return outcome(agent,href);
            if (msg.startsWith("Sorry")) {
                return [msg,""];
            }
            let title = data.links?.next?.action?.title;
            let des = data.links?.next?.action?.description + " Our AI agent will claim the prize for you.";
            let href = data.links?.next?.action?.links?.actions?.[0]?.href;
            let res = await outcome(href);
            return [title,des,res];
        } else {
            return "failed";
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS game failed: ${error.message}`);
    }
}
async function outcome(href: string):Promise<string> {
    try {
        const connection = new Connection(clusterApiUrl("devnet"));
        const KEYPAIR = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SENDER_SECRET!));;
        const ADDRESS = KEYPAIR.publicKey;
        const PRIVATE_KEY = KEYPAIR.secretKey;
        const res = await fetch(
            `https://rps-solana-blinks.vercel.app${href}`,
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
        const msg = data.message;
        if (data.transaction) {
            console.log(data.message);
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));

            // Sign and send transaction
            txn.sign(KEYPAIR);
            sendAndConfirmTransaction(connection, txn, [KEYPAIR]);             
            return msg;
        } else {
            return "failed";
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }

}