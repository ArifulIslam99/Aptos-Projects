module cast_protocol_addr::account {
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use std::option;
    use aptos_framework::object::{Self, ExtendRef};
    use aptos_framework::event;
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_std::table::{Self, Table};

    // Error codes
    /// Error code when account already exists in the protocol
    const E_ACCOUNT_ALREADY_EXISTS: u64 = 1;
    /// Error code when caller is not the owner of the account
    const E_NOT_OWNER: u64 = 2;
    /// Error code when subscription feature is disabled
    const E_SUBSCRIPTION_DISABLED: u64 = 3;
    /// Error code when user is not subscribed to a creator
    const E_NOT_SUBSCRIBED: u64 = 4;
    /// Error code when account is not found in the protocol
    const E_ACCOUNT_NOT_FOUND: u64 = 5;
    /// Error code when attempting to subscribe to own account
    const E_CANNOT_SUBSCRIBE_TO_SELF: u64 = 6;

    // Collection constants
    const COLLECTION_NAME: vector<u8> = b"Channelzz";
    const COLLECTION_DESCRIPTION: vector<u8> = b"Channelzz Account NFTs";
    const COLLECTION_URI: vector<u8> = b"https://channelzz.io/collection";

    // Account configuration
    struct AccountConfig has store, drop, copy {
        subscription_enabled: bool
    }

    // Main account resource (stored as Object)
    struct Account has key {
        owner: address,
        full_name: String,
        config: AccountConfig,
        subscribers: vector<address>, // Accounts subscribed to me
        subscribed_to: vector<address>, // Accounts I'm subscribed to
        extend_ref: ExtendRef // For mutating the object
    }

    // Global registry to track owner -> account object mapping
    struct AccountRegistry has key {
        accounts: Table<address, address> // owner_address -> account_object_address
    }

    // Collection manager to hold collection references
    struct CollectionManager has key {
        extend_ref: ExtendRef
    }

    // Events
    #[event]
    struct AccountCreatedEvent has drop, store {
        owner: address,
        account_object: address,
        nft_address: address,
        full_name: String
    }

    #[event]
    struct SubscribeEvent has drop, store {
        subscriber: address,
        subscribed_to: address
    }

    #[event]
    struct UnsubscribeEvent has drop, store {
        subscriber: address,
        unsubscribed_from: address
    }

    // Initialize the module - called once on deployment
    fun init_module(deployer: &signer) {
        // Create the Channelzz NFT collection
        let constructor_ref =
            collection::create_unlimited_collection(
                deployer,
                string::utf8(COLLECTION_DESCRIPTION),
                string::utf8(COLLECTION_NAME),
                option::none(),
                string::utf8(COLLECTION_URI)
            );

        // Store collection manager
        let collection_signer = object::generate_signer(&constructor_ref);
        move_to(
            &collection_signer,
            CollectionManager { extend_ref: object::generate_extend_ref(&constructor_ref) }
        );

        // Create global registry
        move_to(deployer, AccountRegistry { accounts: table::new() });
    }

    // Create a new account and mint Channelzz NFT
    public entry fun create_account(
        user: &signer, full_name: String
    ) acquires AccountRegistry, CollectionManager {
        let user_addr = signer::address_of(user);

        // Ensure user doesn't already have an account
        let registry = borrow_global_mut<AccountRegistry>(@cast_protocol_addr);
        assert!(
            !table::contains(&registry.accounts, user_addr), E_ACCOUNT_ALREADY_EXISTS
        );

        // Create account object
        let constructor_ref = object::create_object(user_addr);
        let object_signer = object::generate_signer(&constructor_ref);
        let account_address = signer::address_of(&object_signer);

        // Mint Channelzz NFT to user
        let nft_address = mint_channelzz_nft(user, &full_name);

        // Create and store Account resource
        move_to(
            &object_signer,
            Account {
                owner: user_addr,
                full_name,
                config: AccountConfig { subscription_enabled: true },
                subscribers: vector::empty(),
                subscribed_to: vector::empty(),
                extend_ref: object::generate_extend_ref(&constructor_ref)
            }
        );

        // Register in global registry
        table::add(&mut registry.accounts, user_addr, account_address);

        // Emit event
        event::emit(
            AccountCreatedEvent {
                owner: user_addr,
                account_object: account_address,
                nft_address,
                full_name
            }
        );
    }

    // Subscribe to another account
    public entry fun subscribe(
        subscriber: &signer, target_owner: address
    ) acquires AccountRegistry, Account {
        let subscriber_addr = signer::address_of(subscriber);

        // Cannot subscribe to yourself
        assert!(subscriber_addr != target_owner, E_CANNOT_SUBSCRIBE_TO_SELF);

        // Get both account objects
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);

        let subscriber_account_addr = *table::borrow(
            &registry.accounts, subscriber_addr
        );
        assert!(table::contains(&registry.accounts, target_owner), E_ACCOUNT_NOT_FOUND);
        let target_account_addr = *table::borrow(&registry.accounts, target_owner);

        // Phase 1: Check and update subscriber's account
        {
            let subscriber_account = borrow_global_mut<Account>(subscriber_account_addr);
            assert!(subscriber_account.owner == subscriber_addr, E_NOT_OWNER);

            if (!vector::contains(
                &subscriber_account.subscribed_to, &target_account_addr
            )) {
                vector::push_back(
                    &mut subscriber_account.subscribed_to, target_account_addr
                );
            };
        }; // subscriber_account borrow ends here

        // Phase 2: Check and update target's account
        {
            let target_account = borrow_global_mut<Account>(target_account_addr);
            assert!(
                target_account.config.subscription_enabled, E_SUBSCRIPTION_DISABLED
            );

            if (!vector::contains(
                &target_account.subscribers, &subscriber_account_addr
            )) {
                vector::push_back(
                    &mut target_account.subscribers, subscriber_account_addr
                );
            };
        }; // target_account borrow ends here

        // Emit event
        event::emit(
            SubscribeEvent {
                subscriber: subscriber_account_addr,
                subscribed_to: target_account_addr
            }
        );
    }

    // Unsubscribe from an account
    public entry fun unsubscribe(
        subscriber: &signer, target_owner: address
    ) acquires AccountRegistry, Account {
        let subscriber_addr = signer::address_of(subscriber);

        // Get both account objects
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);

        let subscriber_account_addr = *table::borrow(
            &registry.accounts, subscriber_addr
        );
        let target_account_addr = *table::borrow(&registry.accounts, target_owner);

        // Phase 1: Update subscriber's account
        {
            let subscriber_account = borrow_global_mut<Account>(subscriber_account_addr);
            assert!(subscriber_account.owner == subscriber_addr, E_NOT_OWNER);

            let (found, idx) = vector::index_of(
                &subscriber_account.subscribed_to, &target_account_addr
            );
            assert!(found, E_NOT_SUBSCRIBED);
            vector::remove(&mut subscriber_account.subscribed_to, idx);
        }; // subscriber_account borrow ends here

        // Phase 2: Update target's account
        {
            let target_account = borrow_global_mut<Account>(target_account_addr);

            let (found2, idx2) = vector::index_of(
                &target_account.subscribers, &subscriber_account_addr
            );
            if (found2) {
                vector::remove(&mut target_account.subscribers, idx2);
            };
        }; // target_account borrow ends here

        // Emit event
        event::emit(
            UnsubscribeEvent {
                subscriber: subscriber_account_addr,
                unsubscribed_from: target_account_addr
            }
        );
    }

    // Toggle subscription enabled/disabled
    public entry fun set_subscription_enabled(
        owner: &signer, enabled: bool
    ) acquires AccountRegistry, Account {
        let owner_addr = signer::address_of(owner);
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);
        let account_addr = *table::borrow(&registry.accounts, owner_addr);

        let account = borrow_global_mut<Account>(account_addr);
        assert!(account.owner == owner_addr, E_NOT_OWNER);

        account.config.subscription_enabled = enabled;
    }

    // Helper function to mint Channelzz NFT
    fun mint_channelzz_nft(user: &signer, full_name: &String): address acquires CollectionManager {
        let collection_manager = borrow_global<CollectionManager>(@cast_protocol_addr);
        let collection_signer =
            object::generate_signer_for_extending(&collection_manager.extend_ref);

        let token_name = string::utf8(b"Channelzz #");
        string::append(&mut token_name, *full_name);

        let constructor_ref =
            token::create(
                &collection_signer,
                string::utf8(COLLECTION_NAME),
                string::utf8(COLLECTION_DESCRIPTION),
                token_name,
                option::none(),
                string::utf8(COLLECTION_URI)
            );

        let token_signer = object::generate_signer(&constructor_ref);
        let token_address = signer::address_of(&token_signer);

        // Transfer NFT to user
        object::transfer(
            &collection_signer,
            object::address_to_object<token::Token>(token_address),
            signer::address_of(user)
        );

        token_address
    }

    // View functions
    #[view]
    public fun account_exists(owner: address): bool acquires AccountRegistry {
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);
        table::contains(&registry.accounts, owner)
    }

    #[view]
    public fun get_account_address(owner: address): address acquires AccountRegistry {
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);
        *table::borrow(&registry.accounts, owner)
    }

    #[view]
    public fun get_subscribers(owner: address): vector<address> acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);
        let account_addr = *table::borrow(&registry.accounts, owner);
        let account = borrow_global<Account>(account_addr);
        account.subscribers
    }

    #[view]
    public fun get_subscribed_to(owner: address): vector<address> acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);
        let account_addr = *table::borrow(&registry.accounts, owner);
        let account = borrow_global<Account>(account_addr);
        account.subscribed_to
    }

    #[view]
    public fun is_subscription_enabled(owner: address): bool acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@cast_protocol_addr);
        let account_addr = *table::borrow(&registry.accounts, owner);
        let account = borrow_global<Account>(account_addr);
        account.config.subscription_enabled
    }
}

