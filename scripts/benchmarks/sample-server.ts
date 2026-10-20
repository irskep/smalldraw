// Read-only /proc sampling on the existing machine; no application instrumentation.
// The small sampler is a separate Bun process and contributes to machine-wide usage.
const duration = Math.min(
  180,
  Math.max(1, Number(process.env.BENCH_SAMPLE_SECONDS ?? 120)),
);
if (!Number.isFinite(duration))
  throw new Error("BENCH_SAMPLE_SECONDS must be a number");
const remote = `
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const pid=fs.readdirSync('/proc').find(p=>/^\\d+$/.test(p)&&(()=>{try{return read('/proc/'+p+'/cmdline').includes('bun\\0apps/server/src/index.ts')}catch{return false}})());
if(!pid)throw Error('Server PID not found');
for(let i=0;i<${duration};i++){
const stat=read('/proc/'+pid+'/stat').split(' ');
const status=read('/proc/'+pid+'/status');
console.log(JSON.stringify({at:new Date().toISOString(),pid,cpuTicks:Number(stat[13])+Number(stat[14]),rssKiB:Number(status.match(/VmRSS:\\s+(\\d+)/)[1]),swapKiB:Number(status.match(/VmSwap:\\s+(\\d+)/)[1]),io:read('/proc/'+pid+'/io'),memory:read('/proc/meminfo'),cpu:read('/proc/stat').split('\\n')[0]}));
await Bun.sleep(1000);
}`;
const quoted = "'" + remote.replaceAll("'", "'\\''") + "'";
const child = Bun.spawn(
  ["fly", "ssh", "console", "-a", "splatterboard", "-C", `bun -e ${quoted}`],
  { stdout: "inherit", stderr: "inherit" },
);
process.exit(await child.exited);

export {};
