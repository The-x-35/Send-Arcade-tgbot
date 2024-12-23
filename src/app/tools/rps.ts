import { MEMO_PROGRAM_ID } from "@solana/actions";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";

export async function claimback(agent: SolanaAgentKit, pubkey: string) {
    try {
        const receiver = new PublicKey(pubkey);
        const connection = agent.connection;
        const sender = agent.wallet.publicKey;

        // Mint address for the token to be transferred
        const mintAddress = "SENDdRQtYMWaQrBroBrJ2Q53fgVuq95CV9UPGEvpCxa";
        const mintPublicKey = new PublicKey(mintAddress);

        const transaction = new Transaction();

        // Get associated token account for the sender and receiver
        const senderTokenAccount = await getAssociatedTokenAddress(mintPublicKey, sender);
        const receiverTokenAccount = await getAssociatedTokenAddress(mintPublicKey, receiver);

        // Check if the receiver's associated token account exists
        const receiverAccountInfo = await connection.getAccountInfo(receiverTokenAccount);
        if (!receiverAccountInfo) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    sender, // Payer
                    receiverTokenAccount,
                    receiver, // Owner of the new account
                    mintPublicKey // Token mint
                )
            );
        }

        // Get the sender's token balance
        const senderTokenBalance = await connection.getTokenAccountBalance(senderTokenAccount);
        const tokenAmount = BigInt(senderTokenBalance.value.amount);

        if (tokenAmount > 0) {
            // Transfer the token balance to the receiver
            transaction.add(
                createTransferInstruction(
                    senderTokenAccount,
                    receiverTokenAccount,
                    sender,
                    tokenAmount
                )
            );
        }

        // Transfer remaining SOL balance to the receiver
        const solBalance = await connection.getBalance(sender);
        const estimatedFee = 0.000008 * LAMPORTS_PER_SOL; // Example fee estimation
        const transferableSol = solBalance - estimatedFee;

        if (transferableSol > 0) {
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: sender,
                    toPubkey: receiver,
                    lamports: transferableSol,
                })
            );
        }

        // Add memo instruction
        transaction.add(
            new TransactionInstruction({
                programId: new PublicKey(MEMO_PROGRAM_ID),
                data: Buffer.from(`claimback:${pubkey}`, "utf8"),
                keys: [],
            })
        );

        // Set the fee payer and recent blockhash
        transaction.feePayer = sender;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // Send the transaction
        await sendAndConfirmTransaction(connection, transaction, [agent.wallet], {
            commitment: 'confirmed',
            skipPreflight: true,
        });

        return "Claimback successful, amount might reflect in your account in some time.";
    } catch (error: any) {
        console.error(error);
        throw new Error(`Claimback failed: ${error.message}`);
    }
}
export async function rps(
    agent: SolanaAgentKit,
    amount: number,
    choice: "rock" | "paper" | "scissors",
) {
    try {
        const res = await fetch(
            `https://rps.sendarcade.fun/api/actions/bot?amount=${amount}&choice=${choice}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    account: agent.wallet.publicKey.toBase58(),
                }),
            },
        );

        const data = await res.json();
        if (data.transaction) {
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));
            txn.sign(agent.wallet);
            txn.recentBlockhash = (
                await agent.connection.getLatestBlockhash()
            ).blockhash;
            const sig = await sendAndConfirmTransaction(
                agent.connection,
                txn,
                [agent.wallet],
                { commitment: 'confirmed', skipPreflight: true }
            );
            let href = data.links?.next?.href;
            return await outcome(agent, sig, href);
        } else {
            return "failed";
        }
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS game failed: ${error.message}`);
    }
}
async function outcome(agent: SolanaAgentKit, sig: string, href: string): Promise<string> {
    try {
        const res = await fetch(
            `https://rps.sendarcade.fun${href}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    account: agent.wallet.publicKey.toBase58(),
                    signature: sig,
                }),
            },
        );

        const data: any = await res.json();
        const title = data.title;
        if (title.startsWith("You lost")) {
            return title;
        }
        let next_href = data.links?.actions?.[0]?.href;
        won(agent, next_href)
        return title + "\n" + "Prize will be claimed automatically.";
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }
}
async function won(agent: SolanaAgentKit, href: string): Promise<string> {
    try {
        const res = await fetch(
            `https://rps.sendarcade.fun${href}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    account: agent.wallet.publicKey.toBase58(),
                }),
            },
        );

        const data: any = await res.json();
        if (data.transaction) {
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));
            txn.partialSign(agent.wallet);
            await agent.connection.sendRawTransaction(txn.serialize(),{ preflightCommitment: 'confirmed', skipPreflight: true });        }
        else {
            return "Failed to claim prize.";
        }
        let next_href = data.links?.next?.href;
        return await postWin(agent, next_href);
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }
}
async function postWin(agent: SolanaAgentKit, href: string): Promise<string> {
    try {
        const res = await fetch(
            `https://rps.sendarcade.fun${href}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    account: agent.wallet.publicKey.toBase58(),
                }),
            },
        );

        const data: any = await res.json();
        const title = data.title;
        return "Prize claimed Successfully" + "\n" + title;
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }
}