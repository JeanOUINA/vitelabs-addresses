import * as vite from "web3-vite"
import labels from "./labels.js"
import { viteTokenId } from "web3-vite/dist/constants.js"

const client = new vite.Client("https://node-vite.thomiz.dev/http")

const blacklist = [
    "vite_0000000000000000000000000000000000000004d28108e76b", // Consensus
    "vite_ac07f8af1a63a272e109a7df53c195fe768464d108a7d8cc67", // Vite Gateway Ethereum
    "vite_5609fdde8dd450d26540955b22cc8d9b950d0bae89203bbdac", // Vite Gateway BSC
    "vite_0000000000000000000000000000000000000003f6af7459b9", // Quota
    "vite_000000000000000000000000000000000000000595292d996d", // SBP
    "vite_591e456aa84fccd65e4c916c258ef3b80fadd94eab6f37518c", // Binance Deposit
    "vite_0ab5b9c50b27647538cbb7918980c1dd4c281b1a53b2a7c4a1", // Binance Withdrawal
    "vite_b6d1f4ab325c2565693a606c9d585e28cfa872c3e9392ed94f", // Coinex Hot Wallet
    "vite_0000000000000000000000000000000000000006e82b8ba657", // ViteX
]

const tokenIssuance = "vite_000000000000000000000000000000000000000595292d996d"
let tokenIssuanceTotal = 0

const binanceDeposit = "vite_591e456aa84fccd65e4c916c258ef3b80fadd94eab6f37518c"
const binanceWithdrawals = [
    "vite_b89e85b83c7d4d7cbe1705d8b3a14d0098b39a50f6bd0e8ca1",
    "vite_0ab5b9c50b27647538cbb7918980c1dd4c281b1a53b2a7c4a1"
]
const binanceMemos = new Set<string>()
let binanceSent = 0
let binanceReceived = 0

const processed = new Set<string>(Object.keys(labels))
const queue = Object.keys(labels)

let balances = 0
while(queue[0]){
    const address = queue.shift()
    const [
        balance,
        accountBlocks
    ] = await Promise.all([
        client.methods.ledger.getAccountInfoByAddress(address)
        .then(infos => infos.balanceInfoMap?.[vite.constants.viteTokenId]?.balance ?? 0)
        .then(balance => Number(BigInt(balance) / 10n**18n)),
        client.methods.ledger.getAccountBlocks(address, null, null, 1000)
        .then(accountBlocks => accountBlocks ?? [])
    ])
    balances += balance
    console.log(
        `${labels[address]} \x1b[31m${Intl.NumberFormat("en-US", {}).format(balance)}\x1b[0m VITE`
    )

    for(const tx of accountBlocks){
        if(tx.tokenId !== viteTokenId)continue
        if(tx.toAddress !== binanceDeposit)continue
        binanceMemos.add(Buffer.from(tx.data ?? "", "base64").toString())
        const amount = Number(BigInt(tx.amount) / 10n**18n)
        binanceSent += amount
    }
    for(const tx of accountBlocks){
        if(tx.tokenId !== viteTokenId)continue
        if(!binanceWithdrawals.includes(tx.fromAddress))continue
        console.log(tx.amount)
        const amount = Number(BigInt(tx.amount) / 10n**18n)
        binanceReceived += amount
    }
    for(const tx of accountBlocks){
        if(tx.tokenId !== viteTokenId)continue
        if(tx.fromAddress !== tokenIssuance)continue
        const amount = Number(BigInt(tx.amount) / 10n**18n)
        tokenIssuanceTotal += amount
    }
    for(const tx of accountBlocks){
        const addr = tx.fromAddress === address ? tx.toAddress : tx.fromAddress
        if(
            tx.tokenId !== vite.constants.viteTokenId ||
            labels[addr] ||
            !tx.amount ||
            blacklist.includes(addr)
        )continue

        const type = tx.fromAddress === address ? "sent" : "received"
        const amount = Number(BigInt(tx.amount) / 10n**18n)
        if(amount <= 100_000)continue
        console.log(`🔔 ${labels[address]} ${type} \x1b[31m${Intl.NumberFormat("en-US", {}).format(amount)}\x1b[0m VITE ${type === "sent" ? "to" : "from"} ${addr}`)
    }
}

console.log(`Total: \x1b[31m${Intl.NumberFormat("en-US", {}).format(balances)}\x1b[0m VITE`)
console.log(`Sent to Binance: \x1b[31m${Intl.NumberFormat("en-US", {}).format(binanceSent)}\x1b[0m VITE`)
console.log(`Received from Binance: \x1b[31m${Intl.NumberFormat("en-US", {}).format(binanceReceived)}\x1b[0m VITE`)
console.log(`Net Binance: \x1b[31m${Intl.NumberFormat("en-US", {}).format(binanceReceived - binanceSent)}\x1b[0m VITE`)
console.log(`Received from SBPs: \x1b[31m${Intl.NumberFormat("en-US", {}).format(tokenIssuanceTotal)}\x1b[0m VITE`)
console.log(`Binance memos: ${[...binanceMemos].join(", ")}`)