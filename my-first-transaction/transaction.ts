import {
    Account,
    Aptos,
    AptosConfig,
    Network,
} from "@aptos-labs/ts-sdk";

async function main() {
    // Initialize the Aptos client
    const config = new AptosConfig({ network: Network.DEVNET });
    const aptos = new Aptos(config);

    console.log("Connected to Aptos devnet");

    // More code will go here

    // Generate two accounts
    const alice = Account.generate();
    const bob = Account.generate();

    console.log("=== Addresses ===");
    console.log(`Alice's address: ${alice.accountAddress}`);
    console.log(`Bob's address: ${bob.accountAddress}`);

    // Fund the accounts with test APT from the devnet faucet
    console.log("\n=== Funding accounts ===");
    await aptos.fundAccount({
        accountAddress: alice.accountAddress,
        amount: 100_000_000, // 1 APT = 100,000,000 octas
    });
    console.log("Accounts funded successfully");

    // Check initial balances
    const aliceBalance = await aptos.getAccountAPTAmount({
        accountAddress: alice.accountAddress,
    });
    const bobBalance = await aptos.getAccountAPTAmount({
        accountAddress: bob.accountAddress,
    });

    console.log("\n=== Initial Balances ===");
    console.log(`Alice: ${aliceBalance} octas`);
    console.log(`Bob: ${bobBalance} octas`);
}

main().catch(console.error);