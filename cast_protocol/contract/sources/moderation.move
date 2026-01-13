module neo_protocol_addr::moderation {
    use std::signer;
    use std::string::String;
    use aptos_framework::object::{Self, Object};
    use aptos_std::table::{Self, Table};

    const ADMIN: address = @0xcc2d76506dc683a202780eaf8ded7b3871a3a9ad482f70f073957ce9237c5fe2;

    /// Error codes
    const ENOT_ADMIN: u64 = 1;
    /// Admin already exists
    const EADMIN_ALREADY_EXISTS: u64 = 2;
    /// Moderation data not found
    const EMODERATION_NOT_FOUND: u64 = 3;
    /// Name not found in registry
    const ENAME_NOT_FOUND: u64 = 4;

    /// Admin configuration
    struct AdminConfig has key {
        admin_address: address,
    }

    /// Combined moderation lists for name management
    struct NameRegistry has key {
        blacklist: Table<String, bool>,  // Permanently banned names
        blocklist: Table<String, bool>,  // Temporarily blocked names
    }

    /// Container that holds the NameRegistry object
    struct ModerationData has key {
        registry_ref: Object<NameRegistry>,
    }

    /// Initialize the moderation system (called once by deployer)
    fun init_module(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        
        // Ensure not already initialized
        assert!(!exists<AdminConfig>(deployer_addr), EADMIN_ALREADY_EXISTS);

        // Create NameRegistry object
        let registry_constructor = object::create_object(deployer_addr);
        let registry_signer = object::generate_signer(&registry_constructor);
        move_to(&registry_signer, NameRegistry {
            blacklist: table::new(),
            blocklist: table::new(),
        });

        // Store reference to the registry
        let registry_obj = object::object_from_constructor_ref<NameRegistry>(&registry_constructor);
        
        move_to(deployer, ModerationData {
            registry_ref: registry_obj,
        });

        // Store admin configuration
        move_to(deployer, AdminConfig {
            admin_address: ADMIN,
        });
    }

    /// Verify caller is admin
    fun assert_is_admin(caller: &signer) acquires AdminConfig {
        let module_addr = @neo_protocol_addr;
        assert!(exists<AdminConfig>(module_addr), EMODERATION_NOT_FOUND);
        
        let admin_config = borrow_global<AdminConfig>(module_addr);
        let caller_addr = signer::address_of(caller);
        
        assert!(caller_addr == admin_config.admin_address, ENOT_ADMIN);
    }

    /// Bulk add names to BlackList
    public entry fun add_to_blacklist(
        admin: &signer,
        names: vector<String>
    ) acquires AdminConfig, ModerationData, NameRegistry {
        assert_is_admin(admin);
        
        let module_addr = @neo_protocol_addr;
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global_mut<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        let i = 0;
        let len = names.length();
        while (i < len) {
            let name = names[i];
            if (!registry.blacklist.contains(name)) {
                registry.blacklist.add(name, true);
            };
            i += 1;
        };
    }

    /// Bulk remove names from BlackList
    public entry fun remove_from_blacklist(
        admin: &signer,
        names: vector<String>
    ) acquires AdminConfig, ModerationData, NameRegistry {
        assert_is_admin(admin);
        
        let module_addr = @neo_protocol_addr;
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global_mut<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        let i = 0;
        let len = names.length();
        while (i < len) {
            let name = names[i];
            if (registry.blacklist.contains(name)) {
                registry.blacklist.remove(name);
            };
            i += 1;
        };
    }

    /// Bulk add names to BlockList
    public entry fun add_to_blocklist(
        admin: &signer,
        names: vector<String>
    ) acquires AdminConfig, ModerationData, NameRegistry {
        assert_is_admin(admin);
        
        let module_addr = @neo_protocol_addr;
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global_mut<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        let i = 0;
        let len = names.length();
        while (i < len) {
            let name = names[i];
            if (!registry.blocklist.contains(name)) {
                registry.blocklist.add(name, true);
            };
            i += 1;
        };
    }

    /// Bulk remove names from BlockList
    public entry fun bulk_remove_from_blocklist(
        admin: &signer,
        names: vector<String>
    ) acquires AdminConfig, ModerationData, NameRegistry {
        assert_is_admin(admin);
        
        let module_addr = @neo_protocol_addr;
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global_mut<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        let i = 0;
        let len = names.length();
        while (i < len) {
            let name = names[i];
            if (registry.blocklist.contains(name)) {
                registry.blocklist.remove(name);
            };
            i += 1;
        };
    }

    /// Transfer admin rights to a new address
    public entry fun transfer_admin(
        current_admin: &signer,
        new_admin_addr: address
    ) acquires AdminConfig {
        assert_is_admin(current_admin);
        
        let module_addr = @neo_protocol_addr;
        let admin_config = borrow_global_mut<AdminConfig>(module_addr);
        admin_config.admin_address = new_admin_addr;
    }

    #[view]
    public fun is_blacklisted(name: String): bool acquires ModerationData, NameRegistry {
        let module_addr = @neo_protocol_addr;
        if (!exists<ModerationData>(module_addr)) {
            return false
        };
        
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        registry.blacklist.contains(name)
    }

    #[view]
    public fun is_blocklisted(name: String): bool acquires ModerationData, NameRegistry {
        let module_addr = @neo_protocol_addr;
        if (!exists<ModerationData>(module_addr)) {
            return false
        };
        
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        registry.blocklist.contains(name)
    }

    #[view]
    public fun is_name_restricted(name: String): bool acquires ModerationData, NameRegistry {
        let module_addr = @neo_protocol_addr;
        if (!exists<ModerationData>(module_addr)) {
            return false
        };
        
        let moderation_data = borrow_global<ModerationData>(module_addr);
        let registry = borrow_global<NameRegistry>(object::object_address(&moderation_data.registry_ref));
        
        registry.blacklist.contains(name) || registry.blocklist.contains(name)
    }

    #[view]
    public fun get_admin(): address acquires AdminConfig {
        let module_addr = @neo_protocol_addr;
        let admin_config = borrow_global<AdminConfig>(module_addr);
        admin_config.admin_address
    }
}