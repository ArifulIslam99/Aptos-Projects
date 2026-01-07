module game_token::game_fa {
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata, FungibleAsset};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use std::option;
    use std::signer; 
    use std::string::{Self, String};

    /// Error codes
    const ENOT_OWNER: u64 = 1;
    const EALREADY_INITIALIZED: u64 = 2;

    /// Holds the refs for the fungible asset
    struct ManagedFungibleAsset has key {
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        burn_ref: BurnRef,
        mutate_metadata_ref: fungible_asset::MutateMetadataRef,
    }

    /// Initialize the GAME fungible asset with fixed supply
    /// This creates the asset metadata and mints the total supply to the creator
    /// CRITICAL: Only the module publisher (deployer) can call this function
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // SECURITY: Ensure only the module publisher can initialize
        assert!(admin_addr == @game_token, ENOT_OWNER);
        
        // Ensure not already initialized
        assert!(!exists<ManagedFungibleAsset>(admin_addr), EALREADY_INITIALIZED);

        // Create a named object for the metadata
        let constructor_ref = &object::create_named_object(admin, b"GAME");
        
        // Initialize the fungible asset with metadata
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::some(1_000_000_000_00000000), // max_supply 10B
            string::utf8(b"GAME"), // name
            string::utf8(b"GAME"), // symbol
            8, // decimals
            string::utf8(b"https://cdn.vectorstock.com/i/1000v/28/60/console-gamepad-cute-kawaii-cartoon-vector-17362860.jpg"), // icon_uri
            string::utf8(b"GAME Token - The ultimate gaming token on Aptos"), // project_uri
        );

        // Generate refs for minting, transferring, and burning
        let mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(constructor_ref);
        let mutate_metadata_ref = fungible_asset::generate_mutate_metadata_ref(constructor_ref);
        
        // Get the metadata object
        let metadata_object_signer = object::generate_signer(constructor_ref);
        let metadata = object::object_from_constructor_ref<Metadata>(constructor_ref);

        // Mint the fixed supply: 1 billion tokens (1,000,000,000 * 10^8 for 8 decimals)
        let fa = fungible_asset::mint(&mint_ref, 1_000_000_000_00000000);
        
        // Deposit to admin's primary store
        primary_fungible_store::deposit(admin_addr, fa);
        // Store the refs in the metadata object
        // Note: We keep mint_ref for technical reasons, but won't use it after initial mint
        move_to(
            &metadata_object_signer,
            ManagedFungibleAsset { mint_ref, transfer_ref, burn_ref, mutate_metadata_ref }
        );
    }

    #[view]
    /// Get the metadata object address for GAME token
    public fun get_metadata(): Object<Metadata> {
        let metadata_address = object::create_object_address(&@game_token, b"GAME");
        object::address_to_object<Metadata>(metadata_address)
    }

    #[view]
    /// Get balance of an account
    public fun balance(account: address): u64 {
        let metadata = get_metadata();
        primary_fungible_store::balance(account, metadata)
    }

    #[view]
    /// Get total supply
    public fun total_supply(): u128 {
        let metadata = get_metadata();
        option::extract(&mut fungible_asset::supply(metadata))
    }

    #[view]
    /// Get token name
    public fun name(): String {
        let metadata = get_metadata();
        fungible_asset::name(metadata)
    }

    #[view]
    /// Get token symbol
    public fun symbol(): String {
        let metadata = get_metadata();
        fungible_asset::symbol(metadata)
    }

    #[view]
    /// Get token decimals
    public fun decimals(): u8 {
        let metadata = get_metadata();
        fungible_asset::decimals(metadata)
    }

    /// Update the icon URI (only callable by module publisher)
    public entry fun update_icon_uri(admin: &signer, new_icon_uri: String) acquires ManagedFungibleAsset {
        let admin_addr = signer::address_of(admin);
        
        // SECURITY: Ensure only the module publisher can update metadata
        assert!(admin_addr == @game_token, ENOT_OWNER);
        
        let metadata = get_metadata();
        let metadata_addr = object::object_address(&metadata);
        
        let managed = borrow_global<ManagedFungibleAsset>(metadata_addr);
        
        // Update only the icon_uri, keep everything else the same
        fungible_asset::mutate_metadata(
            &managed.mutate_metadata_ref,
            option::none(), // name - no change
            option::none(), // symbol - no change
            option::none(), // decimals - no change
            option::some(new_icon_uri), // icon_uri - UPDATE THIS
            option::none(), // project_uri - no change
        );
    }

    /// Update the project URI (only callable by module publisher)
    public entry fun update_project_uri(admin: &signer, new_project_uri: String) acquires ManagedFungibleAsset {
        let admin_addr = signer::address_of(admin);
        
        // SECURITY: Ensure only the module publisher can update metadata
        assert!(admin_addr == @game_token, ENOT_OWNER);
        
        let metadata = get_metadata();
        let metadata_addr = object::object_address(&metadata);
        
        let managed = borrow_global<ManagedFungibleAsset>(metadata_addr);
        
        // Update only the project_uri, keep everything else the same
        fungible_asset::mutate_metadata(
            &managed.mutate_metadata_ref,
            option::none(), // name - no change
            option::none(), // symbol - no change
            option::none(), // decimals - no change
            option::none(), // icon_uri - no change
            option::some(new_project_uri), // project_uri - UPDATE THIS
        );
    }

    // Optional: Burn function if you want ability to reduce supply
    // public entry fun burn(admin: &signer, amount: u64) acquires ManagedFungibleAsset {
    //     let admin_addr = signer::address_of(admin);
    //     let metadata = get_metadata();
    //     let metadata_addr = object::object_address(&metadata);
    //     
    //     assert!(exists<ManagedFungibleAsset>(metadata_addr), ENOT_OWNER);
    //     
    //     let asset = primary_fungible_store::withdraw(admin, metadata, amount);
    //     let managed = borrow_global<ManagedFungibleAsset>(metadata_addr);
    //     fungible_asset::burn(&managed.burn_ref, asset);
    // }
}