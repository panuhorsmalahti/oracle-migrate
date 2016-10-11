# oracle-migrate
Small migrate framework for Oracle DB

## Installation

Before installing this module take note how to install `node-oracledb` [here](https://github.com/oracle/node-oracledb)

    $ npm install oracle-migrate

## Configuration

In your working directory create a file `.oracle-migrate`, for example:

```
/app
/logs
/migrations
/tests
.eslint
.gitignore
.oracle-migrate
app.js
package.json
readme.md
```

The content of this file is a plain JSON with different configurations. Current configuration is taken from NODE_ENV in runtime.

```
{
  "development": {
    "connectionString": "localhost:1521/hr",
    "password": "user",
    "username": "john.doe"
  },
  "production": {
    "connectionString": "localhost:1521/hr",
    "password": "user",
    "username": "john.doe"
  },
  "test": {
    "connectionString": "localhost:1521/hr",
    "password": "user",
    "username": "john.doe"
  }
}
```

This is a plain JSON with different configurations.

## Usage

```
Usage: oracle-migrate [command] [options]

Commands:

    down             migrate down by 1 file
    down   [name]    migrate down till given file name migration
    down   all       migrate down to init state
    up               migrate till most recent migration file
    up     [name]    migrate up till given migration
    create [title]   create a new migration file with [title]

    list             shows all local migration scripts
    history          fetches migration history from the database and shows it

    --install-dep    executes npm to install and save for you dependencies

    help             prints help
```

## Creating Migrations

To create new migration script, execute `oracle-migrate create [title]` with an title. This will create a `js` file within `./migrations/` and related sql files in the `./migrations/sql` folder:

    $ oracle-migrate [title]

For example:

    $ oracle-migrate create add-pets
    $ oracle-migrate create add-owners

SQL files are created empty, so you can write there your own code. Oracle database can't execute multiple SQL statements in one time, therefore they need be separated by delimiter:

    -----

For example:

```
CREATE TABLE COUNTRIES
(
  ID VARCHAR2(20) NOT NULL
, TITLE VARCHAR2(20)
, CONSTRAINT COUNTRIES_PK PRIMARY KEY
  (
    ID
  )
  ENABLE
)
-----
CREATE TABLE PLACES
(
  ID VARCHAR2(20) NOT NULL
, NAME VARCHAR2(20)
, CONSTRAINT PLACES_PK PRIMARY KEY
  (
    ID
  )
  ENABLE
)
```

These SQL statements would be executed in a sequence. When one fails - revert migration will be applied (from currently executed SQL file - `down`).

## Running `up` Migrations

To run all migrations till the most recent state:

    $ oracle-migrate up

For example:

    $ oracle-migrate up
    up : migrations/1316027432511-add-pets.js
    up : migrations/1316027432512-add-jane.js
    up : migrations/1316027432575-add-owners.js
    up : migrations/1316027433425-coolest-pet.js
    migration : complete

To run migrations till given file:

    $ oracle-migrate up 1316027432512-add-jane.js

For example:

    $ oracle-migrate up 1316027432512-add-jane.js
    up : migrations/1316027432511-add-pets.js
    up : migrations/1316027432512-add-jane.js
    migration : complete

## Running `down` Migrations

To run `down` migration by one file:

    $ oracle-migrate down

For example:

    $ oracle-migrate down
    down : migrations/1316027432512-add-jane.js
    down : migrations/1316027432511-add-pets.js
    migration : complete

To run `down` migration till given  file:

    $ oracle-migrate down 1316027432511-add-pets.js

For example:

    $ oracle-migrate down 1316027432511-add-pets.js
    down : migrations/1316027432511-add-pets.js
    migration : complete

To run `down` migration for all files (revert to state before all migrations executed):

    $ oracle-migrate down all

For example:

    $ oracle-migrate down all
    down : migrations/1316027433425-coolest-pet.js
    down : migrations/1316027432575-add-owners.js
    down : migrations/1316027432512-add-jane.js
    down : migrations/1316027432511-add-pets.js
    migration : complete

## Additional commands

Show all local migration scripts:

    $ oracle-migrate list

For example:

    $ oracle-migrate list
    history : local migration files
            : migrations/1316027433425-coolest-pet.js
            : migrations/1316027432575-add-owners.js
            : migrations/1316027432512-add-jane.js
            : migrations/1316027432511-add-pets.js

Show migration history (fetched from database table, which stores that state):

    $ oracle-migrate history

For example:

    $ oracle-migrate history
    history : from database
            : migrations/1316027433425-coolest-pet.js
            : migrations/1316027432575-add-owners.js
            : migrations/1316027432512-add-jane.js
            : migrations/1316027432511-add-pets.js

How to print help:

    $ oracle-migrate help
