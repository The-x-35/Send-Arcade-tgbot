import { sendAndConfirmTransaction, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";

export async function rps(
  agent: SolanaAgentKit,
  amount: number,
  choice: "rock" | "paper" | "scissors",
): Promise<string> {
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

    // Sign and send transaction
    txn.sign(agent.wallet);
    const signature = await sendAndConfirmTransaction(agent.connection, txn, [agent.wallet]);

    return signature;
    } else {
        return "failed";
    }
  } catch (error: any) {
    console.error(error);
    throw new Error(`RPS game failed: ${error.message}`);
  }
}