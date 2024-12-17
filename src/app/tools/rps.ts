import { clusterApiUrl, Connection, sendAndConfirmTransaction, Transaction, VersionedTransaction } from "@solana/web3.js";
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
        const title = data.message;
        return title;
        if (data.transaction) {
            console.log(data.message);
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));

            // Sign and send transaction
            txn.sign(KEYPAIR);
            await sendAndConfirmTransaction(connection, txn, [KEYPAIR]);
            // return outcome(agent,href);
            return title;
        } else {
            return "failed";
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS game failed: ${error.message}`);
    }
}
async function outcome(agent: SolanaAgentKit,href: string):Promise<string> {
    try {
        const connection = new Connection(clusterApiUrl("devnet"));
        const KEYPAIR = agent.wallet;
        const ADDRESS = KEYPAIR.publicKey;
        const PRIVATE_KEY = KEYPAIR.secretKey;
        const res = await fetch(
            `https://rps.sendarcade.fun${href}`,
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
        return data.title;
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }

}