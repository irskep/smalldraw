import { Database } from "bun:sqlite";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as A from "@automerge/automerge";
import { Repo,generateAutomergeUrl,parseAutomergeUrl } from "@automerge/automerge-repo";
import { SqliteStorageAdapter } from "../../apps/server/src/automergeRepo/sqliteStorageAdapter";
const directory=await mkdtemp(join(tmpdir(),"drawing-storage-bench-"));
try {
for (let iteration=0; iteration<3; iteration++) {
for(const wal of [false,true]) {
 const dbPath=join(directory,`${iteration}-${wal}.db`);
 const db=new Database(dbPath);
 db.run(`PRAGMA journal_mode=${wal?'WAL':'DELETE'}`);
 db.close();
 const storage=new SqliteStorageAdapter(dbPath,{journalMode:wal?"WAL":"DELETE"});
 let writes=0,removed=0,bytes=0,compactions=0,compactionMs=0;
 const originalSave=storage.save.bind(storage),originalRemove=storage.remove.bind(storage);
 storage.save=async(key,data)=>{writes++;bytes+=data.length;await originalSave(key,data);};
 storage.remove=async key=>{removed++;await originalRemove(key);};
 const repo=new Repo({storage,network:[]});
 repo.on('doc-metrics',event=>{if(event.type==='doc-compacted'){compactions++;compactionMs+=event.durationMillis;}});
 const {documentId}=parseAutomergeUrl(generateAutomergeUrl());
 let doc=A.from({strokes:[] as A.ImmutableString[]});
 const start=performance.now();
 for(let i=0;i<300;i++) {
  doc=A.change(doc,d=>{d.strokes.push(new A.ImmutableString(JSON.stringify(Array.from({length:200},(_,j)=>[j+i,j/7]))));});
  await repo.storageSubsystem!.saveDoc(documentId,doc);
 }
 const elapsed=performance.now()-start;
 const rows=await storage.loadRange([documentId]);
 const heads=A.getHeads(doc);
 const reloadStart=performance.now();
 const restored=await repo.storageSubsystem!.loadDoc(documentId);
 const reloadMs=performance.now()-reloadStart;
 if(JSON.stringify(A.getHeads(restored!))!==JSON.stringify(heads))throw Error('Persistence mismatch');
 A.free(doc); A.free(restored!);
 await repo.shutdown();
 console.log(JSON.stringify({iteration,wal,strokes:300,writes,removed,bytes,compactions,compactionMs,totalMs:elapsed,retainedChunks:rows.length,storedBytes:rows.reduce((n,r)=>n+r.data.length,0),reloadMs}));
}
} } finally {await rm(directory,{recursive:true,force:true});}
