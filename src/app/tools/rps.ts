import { MEMO_PROGRAM_ID } from "@solana/actions";
import { LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";

export async function claimback(agent:SolanaAgentKit, pubkey:string) {
    try {
        const receiver = new PublicKey(pubkey);
        const balance = await agent.connection.getBalance(agent.wallet.publicKey); // Get sender's balance
        const estimatedFee = 0.000008 * LAMPORTS_PER_SOL; // Example fee estimation
        const amount = parseFloat((balance - estimatedFee).toFixed(4)); // Calculate transferable amount
      
        const transaction = new Transaction();
        transaction.add(
            new TransactionInstruction({
                programId: new PublicKey(MEMO_PROGRAM_ID),
                data: Buffer.from(
                    `claimback:${pubkey}`,
                    "utf8"
                ),
                keys: [],
            })
        );
        transaction.add(SystemProgram.transfer({
            fromPubkey: agent.wallet.publicKey,
            toPubkey: receiver,
            lamports: Number(amount) * LAMPORTS_PER_SOL,
        }));
        // set the end user as the fee payer
        transaction.feePayer = agent.wallet.publicKey;
        // Get the latest Block Hash
        transaction.recentBlockhash = (
            await agent.connection.getLatestBlockhash()
        ).blockhash;
        sendAndConfirmTransaction(
            agent.connection,
            transaction,
            [agent.wallet],
            { commitment: 'confirmed', skipPreflight: true }
        );
        return "Claimback successful, amount might reflect in your account in some time.";
    } catch (error: any) {
        console.error(error);
        throw new Error(`RPS outcome failed: ${error.message}`);
    }
}

export async function rps(
    agent: SolanaAgentKit,
    amount: number,
    choice: "rock" | "paper" | "scissors",
) {
    try {
        const res = await fetch(
            `https://rps.sendarcade.fun/api/actions/backend?amount=${amount}&choice=${choice}`,
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
        console.log(data);
        if (data.transaction) {
            console.log(data.message);
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
            return outcome(agent, sig, href);
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
        return title + "\n" + won(agent, next_href)
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
            console.log(data.message);
            const txn = Transaction.from(Buffer.from(data.transaction, "base64"));
            txn.recentBlockhash = (
                await agent.connection.getLatestBlockhash()
            ).blockhash;
            const sig = await sendAndConfirmTransaction(
                agent.connection,
                txn,
                [agent.wallet],
                { commitment: 'confirmed', skipPreflight: true }
            );
        }
        else {
            return "Failed to claim prize.";
        }
        let next_href = data.links?.next?.href;
        return postWin(agent, next_href);
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