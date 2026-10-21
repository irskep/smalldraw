// Set test database - this file must be loaded before any database imports
process.env.DATABASE_URL = ":memory:";
process.env.AUTOMERGE_DB_PATH = ":memory:";
