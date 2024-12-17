import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import {

    MEMO_PROGRAM_ID,
} from "@solana/actions";
import { SolanaAgentKit } from "solana-agent-kit";

export async function rps(
    agent: SolanaAgentKit,
    amount: number,
    choice: "rock" | "paper" | "scissors",
): Promise<string> {
    try {
        // const res = await fetch(
        //   `https://rps.sendarcade.fun/api/actions/backend?amount=${amount}&choice=${choice}&player=B`,
        //   {
        //     method: "POST",
        //     headers: {
        //       "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify({
        //       account: agent.wallet.publicKey.toBase58(),
        //     }),
        //   },
        // );

        // const data = await res.json();

        // const txn = VersionedTransaction.deserialize(
        //   Buffer.from(data.transaction, "base64"),
        // );
        // const { blockhash } = await agent.connection.getLatestBlockhash();
        // txn.message.recentBlockhash = blockhash;

        // // Sign and send transaction
        // txn.sign([agent.wallet]);
        // const signature = await agent.connection.sendTransaction(txn, {
        //   preflightCommitment: "confirmed",
        //   maxRetries: 3,
        // });

        // const latestBlockhash = await agent.connection.getLatestBlockhash();
        // await agent.connection.confirmTransaction({
        //   signature,
        //   blockhash: latestBlockhash.blockhash,
        //   lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        // });
        // return signature;
        const connection = new Connection(
            clusterApiUrl("devnet"),
        );
        const transaction = new Transaction();
        transaction.add(
            // note: `createPostResponse` requires at least 1 non-memo instruction
            //   ComputeBudgetProgram.setComputeUnitPrice({
            //     microLamports: 1000,
            //   }),
            new TransactionInstruction({
                programId: new PublicKey(MEMO_PROGRAM_ID),
                data: Buffer.from(
                    `User chose ${choice} with bet ${amount} SOL`,
                    "utf8"
                ),
                keys: [{ pubkey: agent.wallet.publicKey, isSigner: true, isWritable: false }],
            })
        );
        const account = new PublicKey("AidmVBuszvzCJ6cWrBQfKNwgNPU4KCvXBcrWh91vitm8");
        transaction.add(SystemProgram.transfer({
            fromPubkey: agent.wallet.publicKey,
            toPubkey: account,
            lamports: Number(amount) * LAMPORTS_PER_SOL,
          }));
    
          // set the end user as the fee payer
          transaction.feePayer = agent.wallet.publicKey;
    
          // Get the latest Block Hash
          transaction.recentBlockhash = (
            await connection.getLatestBlockhash()
          ).blockhash;
        return transaction.recentBlockhash;
    
    } catch (error: any) {
        console.error(error);
        return error.message.toString();
        // throw new Error(`RPS game failed: ${error.message}`);
    }
}