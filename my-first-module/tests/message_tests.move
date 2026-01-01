 #[test_only]
 module my_first_module::message_tests {
    use std::string;
    use std::signer;
    use my_first_module::message;

    #[test(sender= @my_first_module)]
    fun test_set_and_get_message(sender: &signer) {
       // Test setting a message
       message::set_message(sender, string::utf8(b"Hello World"));

       // Verify the message was set correctly
       let stored_message = message::get_message(signer::address_of(sender));
       assert!(stored_message == string::utf8(b"Hello World"), 0)
    }

    #[test(sender=@my_first_module)]
    fun test_update_message(sender: &signer) {
       // Test setting a message
       message::set_message(sender, string::utf8(b"Hello World"));
       // Test updating the message
       message::set_message(sender, string::utf8(b"Hello Aptos"));

       // Verify the message was updated correctly
       let stored_message = message::get_message(signer::address_of(sender));
       assert!(stored_message == string::utf8(b"Hello Aptos"), 0)
    }
 }