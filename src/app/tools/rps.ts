import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";
import fetch from "node-fetch"; // Ensure compatibility in Node.js
import bs58 from "bs58";
import dotenv from "dotenv";
import { MEMO_PROGRAM_ID } from "@solana/actions";
dotenv.config();
export async function claimback(agent:SolanaAgentKit, pubkey:string) {
    try {
        const connection = new Connection(clusterApiUrl("mainnet-beta"));
        const KEYPAIR = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SENDER_SECRET!));;
        const ADDRESS = KEYPAIR.publicKey;
        const PRIVATE_KEY = KEYPAIR.secretKey;
        const receiver = new PublicKey(pubkey);
        const balance = await connection.getBalance(ADDRESS); // Get sender's balance
        const estimatedFee = 0.000008 * LAMPORTS_PER_SOL; // Example fee estimation
      
        const amount = parseFloat((balance - estimatedFee).toFixed(4)); // Calculate transferable amount
      
        const transaction = new Transaction();
        transaction.add(
            // note: `createPostResponse` requires at least 1 non-memo instruction
            //   ComputeBudgetProgram.setComputeUnitPrice({
            //     microLamports: 1000,
            //   }),
            new TransactionInstruction({
                programId: new PublicKey(MEMO_PROGRAM_ID),
                data: Buffer.from(
                    `claimback:${pubkey}`,
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
        await sendAndConfirmTransaction(connection, transaction, [KEYPAIR]);
        return "Claimback successful, amount might reflect in your account in some time.";
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }
}
export async function rps(
    agent: SolanaAgentKit,
    amount: number,
    choice: "R" | "P" | "S",
) {
    try {
        const connection = new Connection(clusterApiUrl("mainnet-beta"));
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
        const msg = data.transaction;
        return [String(msg)];
        // return [msg];
        if (data.transaction) {
            console.log(data.message);
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));

            // Sign and send transaction
            txn.sign(KEYPAIR);
            // await sendAndConfirmTransaction(connection, txn, [KEYPAIR]);
            // txn.recentBlockhash = (
            //     await connection.getLatestBlockhash()
            // ).blockhash;
            await sendAndConfirmTransaction(connection, txn, [KEYPAIR]);
            // return [sig];
            if (msg.startsWith("Sorry")) {
                return [msg, ""];
            }
            let title = data.links?.next?.action?.title;
            let des = " Our AI agent will claim the prize for you.";
            let href = data.links?.next?.action?.links?.actions?.[0]?.href;
            let res = await outcome(agent, href);
            return [title, des, res];
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
        const connection = new Connection(clusterApiUrl("mainnet-beta"));
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
        await sendAndConfirmTransaction(connection, transaction, [KEYPAIR]);
        return msg;
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }

}