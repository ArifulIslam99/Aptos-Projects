module child_channel::nft_collection {
    use std::signer;
    use std::string::{Self, String};
    use std::option::{Self};
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::object::{Self};
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_token_objects::royalty::{Self}; 

    /// Error codes
    const ENOT_AUTHORIZED: u64 = 1;
    /// Invalid payment amount
    const EINVALID_PAYMENT: u64 = 2;
    /// Collection not found
    const ECOLLECTION_NOT_FOUND: u64 = 3;

    /// Collection configuration
    const COLLECTION_NAME: vector<u8> = b"Wild Channel Protocol";
    const COLLECTION_DESCRIPTION: vector<u8> = b"NAME Collection of WildChannel Protocol";
    const COLLECTION_URI: vector<u8> = b"https://wildchannel.io/collection";
    const MINT_PRICE: u64 = 100000000; // 1 APT (8 decimals)
    const ROYALTY_NUMERATOR: u64 = 2;
    const ROYALTY_DENOMINATOR: u64 = 100;

    /// Resource to store collection data
    struct CollectionData has key {
        collection_address: address,
        mint_count: u64,
    }

    struct TokenData has key {
        mutator_ref: token::MutatorRef,
    }

    /// Initialize the collection (called once by the module owner)
    public entry fun initialize_collection(creator: &signer) {
        let creator_addr = signer::address_of(creator);
        
        // Create royalty configuration (2%)
        let royalty = royalty::create(ROYALTY_NUMERATOR, ROYALTY_DENOMINATOR, creator_addr);
        
        // Create the collection
        let constructor_ref = collection::create_unlimited_collection(
            creator,
            string::utf8(COLLECTION_DESCRIPTION),
            string::utf8(COLLECTION_NAME),
            option::some(royalty),
            string::utf8(COLLECTION_URI),
        );

        let collection_signer = object::generate_signer(&constructor_ref);
        let collection_addr = signer::address_of(&collection_signer);

        // Store collection data
        move_to(creator, CollectionData {
            collection_address: collection_addr,
            mint_count: 0,
        });
    }

    /// Mint a new NFT by paying 1 APT
    public entry fun mint_nft(
        minter: &signer,
        token_name: String,
        token_description: String,
        token_uri: String,
    ) acquires CollectionData {
        let module_addr = @child_channel;

        // Verify collection exists
        assert!(exists<CollectionData>(module_addr), ECOLLECTION_NOT_FOUND);
        
        let collection_data = borrow_global_mut<CollectionData>(module_addr);
        
        // Transfer 1 APT from minter to module owner
        coin::transfer<AptosCoin>(minter, module_addr, MINT_PRICE);

        // Create the NFT
        let constructor_ref = &token::create_named_token(
            minter,
            string::utf8(COLLECTION_NAME),
            token_description,
            token_name,
            option::none(),
            token_uri,
        );

        let token_signer = &object::generate_signer(constructor_ref);

        let mutator_ref = token::generate_mutator_ref(constructor_ref);

        move_to(token_signer, TokenData {
            mutator_ref,
        });

        // Increment mint count
        collection_data.mint_count += 1;

        // The token is automatically transferred to the minter
    }

    #[view]
    public fun get_mint_count(): u64 acquires CollectionData {
        let module_addr = @child_channel;
        if (!exists<CollectionData>(module_addr)) {
            return 0
        };
        borrow_global<CollectionData>(module_addr).mint_count
    }


    #[view]
    public fun get_collection_address(): address acquires CollectionData {
        let module_addr = @child_channel;
        assert!(exists<CollectionData>(module_addr), ECOLLECTION_NOT_FOUND);
        borrow_global<CollectionData>(module_addr).collection_address
    }

    #[test_only]
    use aptos_framework::account;

    #[test(creator = @child_channel, minter = @0x123)]
    public fun test_mint_flow(creator: &signer, minter: &signer) acquires CollectionData {
        // Setup
        account::create_account_for_test(signer::address_of(creator));
        account::create_account_for_test(signer::address_of(minter));
        
        // Initialize collection
        initialize_collection(creator);
        
        // Verify mint count is 0
        assert!(get_mint_count() == 0, 0);
        
        // Note: Full minting test would require APT coin setup
    }
}