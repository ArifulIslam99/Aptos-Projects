module neo_protocol_addr::account {
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_framework::object::{Self, ExtendRef};
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};

    // Error codes
    /// The account already exists for this user
    const E_ACCOUNT_ALREADY_EXISTS: u64 = 1;
    /// The signer is not the owner of the account
    const E_NOT_OWNER: u64 = 2;
    /// Subscription functionality is disabled for this account
    const E_SUBSCRIPTION_DISABLED: u64 = 3;
    /// The user is not subscribed to the target account
    const E_NOT_SUBSCRIBED: u64 = 4;
    /// The account was not found in the registry
    const E_ACCOUNT_NOT_FOUND: u64 = 5;
    /// A user cannot subscribe to their own account
    const E_CANNOT_SUBSCRIBE_TO_SELF: u64 = 6;

    // Account configuration
    struct AccountConfig has store, drop, copy {
        subscription_enabled: bool,
    }

    // Main account resource (stored as Object)
    struct Account has key {
        owner: address,
        full_name: String,
        config: AccountConfig,
        subscribers: vector<address>,      // Accounts subscribed to me
        subscribed_to: vector<address>,    // Accounts I'm subscribed to
        extend_ref: ExtendRef,             // For mutating the object
    }

    // Global registry to track owner -> account object mapping
    struct AccountRegistry has key {
        accounts: Table<address, address>, // owner_address -> account_object_address
    }

    // Events
    #[event]
    struct AccountCreatedEvent has drop, store {
        owner: address,
        account_object: address,
        full_name: String,
    }

    #[event]
    struct SubscribeEvent has drop, store {
        subscriber: address,
        subscribed_to: address,
    }

    #[event]
    struct UnsubscribeEvent has drop, store {
        subscriber: address,
        unsubscribed_from: address,
    }

    // Initialize the module - called once on deployment
    fun init_module(deployer: &signer) {
        // Create global registry
        move_to(deployer, AccountRegistry {
            accounts: table::new(),
        });
    }

    // Create a new account
    public entry fun create_account(
        user: &signer,
        full_name: String,
    ) acquires AccountRegistry {
        let user_addr = signer::address_of(user);
        
        // Ensure user doesn't already have an account
        let registry = borrow_global_mut<AccountRegistry>(@neo_protocol_addr);
        assert!(!registry.accounts.contains(user_addr), E_ACCOUNT_ALREADY_EXISTS);

        // Create account object
        let constructor_ref = object::create_object(user_addr);
        let object_signer = object::generate_signer(&constructor_ref);
        let account_address = signer::address_of(&object_signer);

        // Create and store Account resource
        move_to(&object_signer, Account {
            owner: user_addr,
            full_name,
            config: AccountConfig {
                subscription_enabled: true,
            },
            subscribers: vector::empty(),
            subscribed_to: vector::empty(),
            extend_ref: object::generate_extend_ref(&constructor_ref),
        });

        // Register in global registry
        registry.accounts.add(user_addr, account_address);

        // Emit event
        event::emit(AccountCreatedEvent {
            owner: user_addr,
            account_object: account_address,
            full_name,
        });
    }

    // Subscribe to another account
    public entry fun subscribe(
        subscriber: &signer,
        target_owner: address,
    ) acquires AccountRegistry, Account {
        let subscriber_addr = signer::address_of(subscriber);
        
        // Cannot subscribe to yourself
        assert!(subscriber_addr != target_owner, E_CANNOT_SUBSCRIBE_TO_SELF);
        
        // Get both account objects
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        
        let subscriber_account_addr = *registry.accounts.borrow(subscriber_addr);
        assert!(registry.accounts.contains(target_owner), E_ACCOUNT_NOT_FOUND);
        let target_account_addr = *registry.accounts.borrow(target_owner);

        // Phase 1: Check and update subscriber's account
        {
            let subscriber_account = borrow_global_mut<Account>(subscriber_account_addr);
            assert!(subscriber_account.owner == subscriber_addr, E_NOT_OWNER);
            
            if (!subscriber_account.subscribed_to.contains(&target_account_addr)) {
                subscriber_account.subscribed_to.push_back(target_account_addr);
            };
        }; // subscriber_account borrow ends here

        // Phase 2: Check and update target's account
        {
            let target_account = borrow_global_mut<Account>(target_account_addr);
            assert!(target_account.config.subscription_enabled, E_SUBSCRIPTION_DISABLED);
            
            if (!target_account.subscribers.contains(&subscriber_account_addr)) {
                target_account.subscribers.push_back(subscriber_account_addr);
            };
        }; // target_account borrow ends here

        // Emit event
        event::emit(SubscribeEvent {
            subscriber: subscriber_account_addr,
            subscribed_to: target_account_addr,
        });
    }

    // Unsubscribe from an account
    public entry fun unsubscribe(
        subscriber: &signer,
        target_owner: address,
    ) acquires AccountRegistry, Account {
        let subscriber_addr = signer::address_of(subscriber);
        
        // Get both account objects
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        
        let subscriber_account_addr = *registry.accounts.borrow(subscriber_addr);
        let target_account_addr = *registry.accounts.borrow(target_owner);

        // Phase 1: Update subscriber's account
        {
            let subscriber_account = borrow_global_mut<Account>(subscriber_account_addr);
            assert!(subscriber_account.owner == subscriber_addr, E_NOT_OWNER);

            let (found, idx) = subscriber_account.subscribed_to.index_of(&target_account_addr);
            assert!(found, E_NOT_SUBSCRIBED);
            subscriber_account.subscribed_to.remove(idx);
        }; // subscriber_account borrow ends here

        // Phase 2: Update target's account
        {
            let target_account = borrow_global_mut<Account>(target_account_addr);
            
            let (found2, idx2) = target_account.subscribers.index_of(&subscriber_account_addr);
            if (found2) {
                target_account.subscribers.remove(idx2);
            };
        }; // target_account borrow ends here

        // Emit event
        event::emit(UnsubscribeEvent {
            subscriber: subscriber_account_addr,
            unsubscribed_from: target_account_addr,
        });
    }

    // Toggle subscription enabled/disabled
    public entry fun set_subscription_enabled(
        owner: &signer,
        enabled: bool,
    ) acquires AccountRegistry, Account {
        let owner_addr = signer::address_of(owner);
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        let account_addr = *registry.accounts.borrow(owner_addr);
        
        let account = borrow_global_mut<Account>(account_addr);
        assert!(account.owner == owner_addr, E_NOT_OWNER);
        
        account.config.subscription_enabled = enabled;
    }

    // View functions
    #[view]
    public fun is_initialized(): bool {
        exists<AccountRegistry>(@neo_protocol_addr)
    }

    #[view]
    public fun account_exists(owner: address): bool acquires AccountRegistry {
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        registry.accounts.contains(owner)
    }

    #[view]
    public fun get_account_address(owner: address): address acquires AccountRegistry {
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        *registry.accounts.borrow(owner)
    }

    #[view]
    public fun get_subscribers(owner: address): vector<address> acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        let account_addr = *registry.accounts.borrow(owner);
        let account = borrow_global<Account>(account_addr);
        account.subscribers
    }

    #[view]
    public fun get_subscribed_to(owner: address): vector<address> acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        let account_addr = *registry.accounts.borrow(owner);
        let account = borrow_global<Account>(account_addr);
        account.subscribed_to
    }

    #[view]
    public fun is_subscription_enabled(owner: address): bool acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        let account_addr = *registry.accounts.borrow(owner);
        let account = borrow_global<Account>(account_addr);
        account.config.subscription_enabled
    }

    #[view]
    public fun get_account_info(owner: address): (String, bool, u64, u64) acquires AccountRegistry, Account {
        let registry = borrow_global<AccountRegistry>(@neo_protocol_addr);
        let account_addr = *registry.accounts.borrow(owner);
        let account = borrow_global<Account>(account_addr);
        
        (
            account.full_name,
            account.config.subscription_enabled,
            account.subscribers.length(),
            account.subscribed_to.length()
        )
    }
}