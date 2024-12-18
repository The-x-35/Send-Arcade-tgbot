import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";
import fetch from "node-fetch"; // Ensure compatibility in Node.js
import bs58 from "bs58";
import dotenv from "dotenv";
import { MEMO_PROGRAM_ID } from "@solana/actions";
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
            await sendAndConfirmTransaction(connection, txn, [KEYPAIR]);
            await connection.sendTransaction(txn, [KEYPAIR]);
            if (msg.startsWith("Sorry")) {
                return [msg, ""];
            }
            let title = data.links?.next?.action?.title;
            let des = data.links?.next?.action?.description + " Our AI agent will claim the prize for you.";
            let href = data.links?.next?.action?.links?.actions?.[0]?.href;
            let res = await outcome(agent, href);
            return [title, des, href];
        } else {
            return "failed";
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS game failed: ${error.message}`);
    }
}
async function outcome(agent: SolanaAgentKit, href: string): Promise<string> {
    try {
        const connection = new Connection(clusterApiUrl("devnet"));
        const KEYPAIR = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SENDER_SECRET!));;
        const ADDRESS = KEYPAIR.publicKey;
        const PRIVATE_KEY = KEYPAIR.secretKey;
        const receiver = await agent.wallet.publicKey;
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

        // Extract the query part of the URL
        const queryString = href.split('?')[1];

        // Use URLSearchParams to parse the query
        const params = new URLSearchParams(queryString);

        // Get the "amount" parameter and parse it as a float
        const amount = parseFloat(params.get("amount")!);

        console.log(amount); // Output: 0.02
        const transaction = new Transaction();
        transaction.add(
            // note: `createPostResponse` requires at least 1 non-memo instruction
            //   ComputeBudgetProgram.setComputeUnitPrice({
            //     microLamports: 1000,
            //   }),
            new TransactionInstruction({
                programId: new PublicKey(MEMO_PROGRAM_ID),
                data: Buffer.from(
                    `outcome:${msg}`,
                    "utf8"
                ),
                keys: [],
            })
        );
        // // ensure the receiving account will be rent exempt
        // const minimumBalance = await connection.getMinimumBalanceForRentExemption(
        //   0, // note: simple accounts that just store native SOL have `0` bytes of data
        // );
        // if (Number(amount) * LAMPORTS_PER_SOL < minimumBalance) {
        //   throw `account may not be rent exempt.`;
        // }
        transaction.add(SystemProgram.transfer({
            fromPubkey: ADDRESS,
            toPubkey: receiver,
            lamports: Number(amount) * LAMPORTS_PER_SOL,
        }));

        // set the end user as the fee payer
        transaction.feePayer = ADDRESS;

        // Get the latest Block Hash
        transaction.recentBlockhash = (
            await connection.getLatestBlockhash()
        ).blockhash;
        sendAndConfirmTransaction(connection, transaction, [KEYPAIR]);
        return msg;
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }

}