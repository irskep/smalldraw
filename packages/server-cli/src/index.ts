#!/usr/bin/env bun

import { runCli } from "./cli";

const result = await runCli(process.argv.slice(2));
if (result !== undefined) {
  console.log(JSON.stringify(result, null, 2));
}
