import fetch from 'node-fetch'
import { config } from 'dotenv'
import { Connection, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

config()

const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`)
const PRIVATE_KEY = process.env.PRIVATE_KEY
const KEYPAIR = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))
const ADDRESS = KEYPAIR.publicKey
console.log(ADDRESS.toBase58())

async function sendIt(url) {
  try {
    console.log("address", ADDRESS.toBase58())
    // Send a POST request with JSON body
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ account: ADDRESS.toBase58() })
    })
    const data = await response.json()
    console.log(data)

    if (data.transaction) {
      console.log(data.message)

      // Decode the transaction from base64
      const transaction = Transaction.from(Buffer.from(data.transaction, 'base64'))

      // Add the keypair as a signer
      transaction.sign(KEYPAIR)

      // Send and confirm the transaction
      const signature = await sendAndConfirmTransaction(connection, transaction, [KEYPAIR])
      console.log(`Transaction confirmed with signature: ${signature}`)

    } else {
      console.log('No transaction data received.')
    }
  } catch (error) {
    console.error('Error fetching or sending transaction:', error)
  }
}

const blink = 'https://rps.sendarcade.fun/api/actions/bot?amount=0.0000001&choice=rock'
await sendIt(blink)