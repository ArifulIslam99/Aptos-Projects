module neo_protocol_addr::channelz{
    use std::signer;
    use std::string::{Self, String};
    use std::option::{Self};
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::object::{Self}; 
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_token_objects::royalty::{Self}; 
    friend neo_protocol_addr::account;

    /// Error codes
    const ENOT_AUTHORIZED: u64 = 1;
    const EINVALID_PAYMENT: u64 = 2;
    /// Collection not found
    const ECOLLECTION_NOT_FOUND: u64 = 3;

    const REVENUE_MANAGER: address = @0x78c43e52164bb3139a9e9eb76d266385389dcfc879f60da325321f273668645e;

    /// Collection configuration
    const COLLECTION_NAME: vector<u8> = b"Channelz";
    const COLLECTION_DESCRIPTION: vector<u8> = b"Global Dummy Collection";
    const COLLECTION_URI: vector<u8> = b"https://dummychannelz.xyz";
    const MINT_PRICE: u64 = 100000000; // 1 APT (8 decimals)
    const ROYALTY_NUMERATOR: u64 = 2;
    const ROYALTY_DENOMINATOR: u64 = 100;

    /// Resource to store collection data and signer capability
    struct CollectionData has key {
        collection_address: address,
        signer_cap: account::SignerCapability,
        mint_count: u64,
    }

    struct TokenData has key {
        mutator_ref: token::MutatorRef,
    }

    /// Initialize the collection (called once by the module owner)
    fun init_module(creator: &signer) {
        // Create resource account for managing the collection
        let (resource_signer, signer_cap) = account::create_resource_account(
            creator, 
            b"channelz_seed"
        );
        
        let resource_addr = signer::address_of(&resource_signer);
        
        // Create royalty configuration (2%)
        let royalty = royalty::create(ROYALTY_NUMERATOR, ROYALTY_DENOMINATOR, resource_addr);
        
        // Create the collection using resource account
        let constructor_ref = collection::create_unlimited_collection(
            &resource_signer,
            string::utf8(COLLECTION_DESCRIPTION),
            string::utf8(COLLECTION_NAME),
            option::some(royalty),
            string::utf8(COLLECTION_URI),
        );

        let collection_signer = object::generate_signer(&constructor_ref);
        let collection_addr = signer::address_of(&collection_signer);

        // Store collection data with signer capability
        move_to(creator, CollectionData {
            collection_address: collection_addr,
            signer_cap,
            mint_count: 0,
        });
    }

    /// Mint a new NFT by paying 1 APT
    friend fun mint_channelz(
        minter: &signer,
        token_name: String,
    ) acquires CollectionData {
        let module_addr = @neo_protocol_addr;
        
        // Verify collection exists
        assert!(exists<CollectionData>(module_addr), ECOLLECTION_NOT_FOUND);
        
        let collection_data = borrow_global_mut<CollectionData>(module_addr);
        
        // Transfer 1 APT from minter to revenue manager
        coin::transfer<AptosCoin>(minter, REVENUE_MANAGER, MINT_PRICE);

        // Get resource account signer
        let resource_signer = account::create_signer_with_capability(&collection_data.signer_cap);

        // Create the NFT using resource account (collection owner)
        let constructor_ref = token::create_named_token(
            &resource_signer,  // Use resource account, not minter
            string::utf8(COLLECTION_NAME),
            string::utf8(b"Channelz NFT"),
            token_name,
            option::none(),
            string::utf8(b"https://media.istockphoto.com/id/506326266/vector/retro-colorful-tv-vector-illustration.jpg?s=612x612&w=0&k=20&c=mHKkrPG4HxxcPavqdP5_3Em9drNX7miFjE6gmxn8WGs="),
        );

        let token_signer = object::generate_signer(&constructor_ref);

        let mutator_ref = token::generate_mutator_ref(&constructor_ref);

        move_to(&token_signer, TokenData {
            mutator_ref,
        });

        // Increment mint count
        collection_data.mint_count += 1;

        // Token is automatically transferred to the minter
        // Note: You may want to explicitly transfer if needed
        let token_address = object::address_from_constructor_ref(&constructor_ref);
        object::transfer(&resource_signer, object::address_to_object<token::Token>(token_address), signer::address_of(minter));
    }
}