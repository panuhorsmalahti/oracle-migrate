# oracle-migrate
Small migrate framework for Oracle DB

## Installation

    $ npm install oracle-migrate

## Configuration

Currently you should have theese evironment variables configured in your system:

```
  database username:      NODE_ORACLEDB_USER
  database password:      NODE_ORACLEDB_PASSWORD
  url to database:        NODE_ORACLEDB_CONNECTIONSTRING
  (e.g. `localhost:1521`)
```

## Usage

```
Usage: migrate [options] [command]

Commands:

    down             migrate down by 1 file
    down   [name]    migrate down till given migration
    down   all       migrate down to init state
    up     [name]    migrate up till given migration (the default command)
    create [title]   create a new migration file with optional [title]

    history          fetches migration history from the database and shows it

    help             prints help
```

## Creating Migrations

To create a migration, execute `migrate create` with an title. When title is not specified - `noname` will be added. This will create a node module within `./migrations/` which contains the following two exports and related sql files in the `./migrations/sql` folder:

    exports.up = function(next){
      ...
    };

    exports.down = function(next){
      ...
    };

For example:

    $ migrate create add-pets
    $ migrate create add-owners

## Running Migrations

When first running the migrations, all will be executed in sequence.

    $ migrate up
    up : migrations/1316027432511-add-pets.js
    up : migrations/1316027432512-add-jane.js
    up : migrations/1316027432575-add-owners.js
    up : migrations/1316027433425-coolest-pet.js
    migration : complete

Subsequent attempts will simply output "complete", as they have already been executed in this machine. `node-migrate` knows this because it stores the current state in the database table called `MIGRATIONS`.

    $ migrate
    migration : complete

If we were to create another migration using `migrate create`, and then execute migrations again, we would execute only those not previously executed:

    $ migrate
    up : migrates/1316027433455-coolest-owner.js

You can also run migrations incrementally by specifying a migration.

    $ migrate up 1316027433425-
    coolest-pet.js
    up : migrations/1316027432511-add-pets.js
    up : migrations/1316027432512-add-jane.js
    up : migrations/1316027432575-add-owners.js
    up : migrations/1316027433425-coolest-pet.js
    migration : complete

This will run up-migrations upto (and including) `1316027433425-coolest-pet.js`. Similarly you can run down-migrations upto (and including) a specific migration, instead of migrating all the way down.

    $ migrate down 1316027432512-add-jane.js
    down : migrations/1316027432575-add-owners.js
    down : migrations/1316027432512-add-jane.js
    migration : complete

When you run `down all` it will revert all migrations:

    $ migrate down all
    down : migrations/1316027432575-add-owners.js
    down : migrations/1316027432512-add-jane.js
    migration : complete

## Issues

* Check revert in transactions to make sure that this works correctly
* Make that sqls can contain multiple statements with custom delimeter
