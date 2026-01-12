module neo_protocol_addr::channelz{
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
    /// The payment provided is invalid
    const EINVALID_PAYMENT: u64 = 2;
    /// The collection was not found
    const ECOLLECTION_NOT_FOUND: u64 = 3;


    const REVENUE_MANAGER: address = @0x78c43e52164bb3139a9e9eb76d266385389dcfc879f60da325321f273668645e;

     /// Collection configuration
    const COLLECTION_NAME: vector<u8> = b"Channelz";
    const COLLECTION_DESCRIPTION: vector<u8> = b"Global Dummy Collection";
    const COLLECTION_URI: vector<u8> = b"https://dummychannelz.xyz";
    const MINT_PRICE: u64 = 100000000; // 1 APT (8 decimals)
    const ROYALTY_NUMERATOR: u64 = 2;
    const ROYALTY_DENOMINATOR: u64 = 100;

    // Resource to store collection data
    struct CollectionData has key {
        collection_address: address
    }

    struct TokenData has key {
        mutator_ref: token::MutatorRef,
    }


    /// Initialize the collection (called once by the module owner)
    fun init_module(creator: &signer) {
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

        //Store collection data
        move_to(creator, CollectionData {
            collection_address: collection_addr,
        });
    }

     /// Mint a new NFT by paying 1 APT
    public fun mint_channelz(
        minter: &signer,
        token_name: String,
    ) {
        // Transfer 1 APT from minter to module owner
        coin::transfer<AptosCoin>(minter, REVENUE_MANAGER, MINT_PRICE);

        // Create the NFT
        let constructor_ref = &token::create_named_token(
            minter,
            string::utf8(COLLECTION_NAME),
            string::utf8(b"Channelz NFT"),
            token_name,
            option::none(),
            string::utf8(b"https://media.istockphoto.com/id/506326266/vector/retro-colorful-tv-vector-illustration.jpg?s=612x612&w=0&k=20&c=mHKkrPG4HxxcPavqdP5_3Em9drNX7miFjE6gmxn8WGs="),
        );

        let token_signer = &object::generate_signer(constructor_ref);

        let mutator_ref = token::generate_mutator_ref(constructor_ref);

        move_to(token_signer, TokenData {
            mutator_ref,
        });
    }
}