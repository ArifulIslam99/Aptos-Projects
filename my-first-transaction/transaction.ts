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

    // 1. Build the transaction
    console.log("\n=== 1. Building the transaction ===");
    const transaction = await aptos.transaction.build.simple({
        sender: alice.accountAddress,
        data: {
            function: "0x1::aptos_account::transfer",
            functionArguments: [bob.accountAddress, 1000], // Transfer 1000 octas
        },
    });
    console.log("Transaction built successfully");

    // Access transaction details from the raw transaction
    const rawTxn = transaction.rawTransaction;
    console.log(`Sequence Number: ${rawTxn.sequence_number}`);
    console.log(`Sender: ${rawTxn.sender}`);
    console.log(`Max Gas Amount: ${rawTxn.max_gas_amount}`);
    console.log(`Gas Unit Price: ${rawTxn.gas_unit_price}`);
    console.log(`Expiration Timestamp: ${new Date(Number(rawTxn.expiration_timestamp_secs) * 1000).toISOString()}`);


    // 2. Simulate the transaction
    console.log("\n=== 2. Simulating the transaction ===");
    const [simulationResult] = await aptos.transaction.simulate.simple({
        signerPublicKey: alice.publicKey,
        transaction,
    });

    const gasUsed = parseInt(simulationResult.gas_used);
    const gasUnitPrice = parseInt(simulationResult.gas_unit_price);
    console.log(`Estimated gas units: ${gasUsed}`);
    console.log(`Estimated gas cost: ${gasUsed * gasUnitPrice} octas`);
    console.log(`Transaction would ${simulationResult.success ? "succeed" : "fail"}`);

    // 3. Sign the transaction
    console.log("\n=== 3. Signing the transaction ===");
    const senderAuthenticator = aptos.transaction.sign({
        signer: alice,
        transaction,
    });
    console.log("Transaction signed successfully");

    // 4. Submit the transaction
    console.log("\n=== 4. Submitting the transaction ===");
    const pendingTransaction = await aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator,
    });
    console.log(`Transaction submitted with hash: ${pendingTransaction.hash}`);

    // 5. Wait for the transaction to complete
    console.log("\n=== 5. Waiting for transaction completion ===");
    const txnResult = await aptos.waitForTransaction({
        transactionHash: pendingTransaction.hash,
    });
    console.log(`Transaction completed with status: ${txnResult.success ? "SUCCESS" : "FAILURE"}`);

    // If you want to see more details about the transaction:
    console.log(`VM Status: ${txnResult.vm_status}`);
    console.log(`Gas used: ${txnResult.gas_used}`);

    // Check final balances
    const aliceFinalBalance = await aptos.getAccountAPTAmount({
        accountAddress: alice.accountAddress,
    });
    const bobFinalBalance = await aptos.getAccountAPTAmount({
        accountAddress: bob.accountAddress,
    });

    console.log("\n=== Final Balances ===");
    console.log(`Alice: ${aliceFinalBalance} octas (spent ${aliceBalance - aliceFinalBalance} octas on transfer and gas)`);
    console.log(`Bob: ${bobFinalBalance} octas (received 1000 octas)`);
}

main().catch(console.error);