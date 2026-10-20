import { Database } from "bun:sqlite";

// Match the relevant production keys; isolate lookup cost from HTTP and CRDT work.
const db = new Database(":memory:");
db.run(`CREATE TABLE document_invitations (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, token TEXT UNIQUE, scope TEXT, tag TEXT, revoked_at INTEGER);
CREATE TABLE users_on_documents (user_id TEXT, document_id TEXT, PRIMARY KEY(user_id, document_id));`);
const token = db.query(
  "INSERT INTO document_invitations VALUES (?, ?, ?, ?, NULL, NULL)",
);
const member = db.query("INSERT INTO users_on_documents VALUES (?, ?)");
db.transaction(() => {
  for (let i = 0; i < 10000; i++) {
    for (const scope of ["owner", "share", "device"])
      token.run(`${i}-${scope}`, `doc-${i}`, `token-${i}-${scope}`, scope);
    member.run(`user-${i % 1000}`, `doc-${i}`);
  }
})();
const queries = [
  [
    "token",
    "SELECT * FROM document_invitations WHERE document_id = ? AND scope = 'share' AND revoked_at IS NULL LIMIT 1",
  ],
  ["members", "SELECT * FROM users_on_documents WHERE document_id = ?"],
] as const;
for (const indexed of [false, true]) {
  if (indexed)
    db.run(`CREATE INDEX document_invitations_document_scope_idx ON document_invitations(document_id, scope);
CREATE INDEX users_on_documents_document_idx ON users_on_documents(document_id);`);
  for (const [name, sql] of queries) {
    const query = db.query(sql);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const rows = query.all(`doc-${(i * 7919) % 10000}`);
      if (rows.length !== 1) throw new Error("Lookup mismatch");
    }
    console.log(
      JSON.stringify({
        name,
        indexed,
        drawings: 10000,
        lookups: 1000,
        ms: performance.now() - start,
        plan: db.query(`EXPLAIN QUERY PLAN ${sql}`).all("doc-1"),
      }),
    );
  }
}
db.close();
