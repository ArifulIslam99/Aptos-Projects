import {
    Account,
    MultiKey,
    AnyPublicKey,
    Serializer
} from "@aptos-labs/ts-sdk";

function test() {
    // Use a random Ed25519 key but pretend it's a Keyless PK for testing serialization
    const backupAccount = Account.generate();
    const backupPK = backupAccount.publicKey;

    // Keyless PK is variant 3 in AnyPublicKey
    // Ed25519 is variant 0 in AnyPublicKey

    const mkDirect = new MultiKey({
        publicKeys: [
            backupPK, // Ed25519
            backupPK  // pretending second is also Ed25519 for now
        ],
        signaturesRequired: 1
    });

    const mkAny = new MultiKey({
        publicKeys: [
            new AnyPublicKey(backupPK),
            new AnyPublicKey(backupPK)
        ],
        signaturesRequired: 1
    });

    console.log("Direct MultiKey Auth Key:", mkDirect.authKey().toString());
    console.log("Anywrapped MultiKey Auth Key:", mkAny.authKey().toString());

    // Let's check the bytes of a MultiKey with different types
    // Note: I can't easily construct a KeylessPublicKey without JWT in this script context
    // but I can check if AnyPublicKey(Ed25519) produces the same bytes as manual Variant 0

    const anyWrapped = new AnyPublicKey(backupPK);
    const serializer = new Serializer();
    anyWrapped.serialize(serializer);
    const anyWrappedBytes = serializer.toUint8Array();

    const manualSerializer = new Serializer();
    manualSerializer.serializeU8(0); // Ed25519 variant
    backupPK.serialize(manualSerializer);
    const manualBytes = manualSerializer.toUint8Array();

    console.log("AnyWrapped bytes match manual Variant 0:",
        Buffer.from(anyWrappedBytes).equals(Buffer.from(manualBytes)));

    // If Keyless is Variant 3
    const manualKeylessSerializer = new Serializer();
    manualKeylessSerializer.serializeU8(3); // Keyless
    backupPK.serialize(manualKeylessSerializer);
    const manualKeylessBytes = manualKeylessSerializer.toUint8Array();
    console.log("Manual Variant 3 length:", manualKeylessBytes.length);

}

test();
