module todolist_addr::todolist {

    use aptos_std::table::{Table, Self};
    use std::string::{Self, String};
    use aptos_framework::event;
    use std::signer;

    struct TodoList has key {
        tasks: Table<u64, Task>,
        task_counter: u64
    }

    /// Individual task structure
    struct Task has store, drop, copy {
        task_id: u64,
        creator_addr: address,
        content: String,
        completed: bool,
    }

    #[event]
    struct TaskCreated has drop, store {
        task_id: u64,
        creator_addr: address,
        content: String,
        completed: bool,
    }

    /// Initializes a new todo list for the account
    public entry fun create_list(account: &signer) {
        let tasks_holder = TodoList {
            tasks: table::new(),
            task_counter: 0
        };
        // Move the TodoList resource under the signer account
        move_to(account, tasks_holder);
    }

    /// Creates a new task in the todo list
    public entry fun create_task(account: &signer, content: String) acquires TodoList {
        // Get the signer address
        let signer_address = signer::address_of(account);

        // assert signer has created a list
        assert!(exists<TodoList>(signer_address), 1);

        // Get the TodoList resource
        let todo_list = borrow_global_mut<TodoList>(signer_address);

        // Increment task counter
        let counter = todo_list.task_counter + 1;

        // Create a new task
        let new_task = Task {
            task_id: counter,
            creator_addr: signer_address,
            content,
            completed: false
        };

        // Add the new task to the tasks table
        todo_list.tasks.upsert(counter, new_task);

        // Update the task counter
        todo_list.task_counter = counter;

        // Emit a task created event
        event::emit(TaskCreated {
            task_id: counter,
            creator_addr: signer_address,
            content,
            completed: false
        })
    }

    /// Marks a task as completed
    public entry fun complete_task(account: &signer, task_id: u64) acquires TodoList {
        // Get the signer address
        let signer_address = signer::address_of(account);

        // Ensure the account has initialized a todo list
        assert!(exists<TodoList>(signer_address), 1);

        // Get the TodoList resource
        let todo_list = borrow_global_mut<TodoList>(signer_address);

        // Ensure the task exists
        assert!(todo_list.tasks.contains(task_id), 2);

        // Get the task record
        let task_record = todo_list.tasks.borrow_mut(task_id);

        // Ensure the task is not already completed
        assert!(task_record.completed == false, 3);

        // Mark the task as completed
        task_record.completed = true;
    }
}