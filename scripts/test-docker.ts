import "./check-bun-version";
import { strict as assert } from "node:assert";

import { $ } from "bun";

const image = "smalldraw:docker-test";
const name = `smalldraw-smoke-${process.pid}`;
const version = (await Bun.file(".bun-version").text()).trim();
await $`docker build --build-arg BUN_VERSION=${version} -t ${image} .`;

// Generate disposable credentials inside the image, exercising its native/WASM deps.
const setup = (
  await $`docker run --rm --entrypoint bun ${image} -e 'import * as opaque from "@serenity-kit/opaque"; await opaque.ready; console.log(opaque.server.createSetup())'`
    .quiet()
    .text()
).trim();
try {
  await $`docker run --detach --rm --name ${name} --publish 127.0.0.1::3000 --env OPAQUE_SERVER_SETUP --env DATABASE_URL=/tmp/app.db --env AUTOMERGE_DB_PATH=/tmp/automerge.db ${image}`
    .env({ ...process.env, OPAQUE_SERVER_SETUP: setup })
    .quiet();
  const waitReady = async () => {
    const mapping = (
      await $`docker port ${name} 3000/tcp`.quiet().text()
    ).trim();
    const origin = `http://${mapping}`;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        if (
          (
            await fetch(`${origin}/healthz`, {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        )
          return origin;
      } catch {
        /* Startup has not opened the port yet. */
      }
      await Bun.sleep(200);
    }
    throw new Error("Container did not become healthy");
  };
  const origin = await waitReady();
  for (const path of ["/", "/draw/", "/favicon.svg"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert((await response.arrayBuffer()).byteLength > 0, path);
  }
  const wasm = [
    ...new Bun.Glob("*.wasm").scanSync("apps/server/build/engine"),
  ][0];
  assert(wasm, "Missing production Automerge WASM");
  const response = await fetch(`${origin}/engine/${wasm}`);
  assert.equal(response.status, 200);
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array(
      await Bun.file(`apps/server/build/engine/${wasm}`).arrayBuffer(),
    ),
  );
  await $`docker exec ${name} bun -e '
    import { existsSync } from "node:fs";
    if (existsSync("node_modules/@types/bun") || existsSync("node_modules/oxlint") || existsSync("/root/.bun/install/cache")) throw Error("Development dependencies or install cache shipped");
    if ([...new Bun.Glob("**/*.{test,spec}.*").scanSync("apps/server/src")].length) throw Error("Tests shipped");
    if (!(await Bun.file("node_modules/@automerge/automerge-repo/dist/Repo.js").text()).includes("#pendingMessages")) throw Error("Automerge patch missing");
  '`;
  await $`docker restart ${name}`.quiet();
  await waitReady();
  console.log(
    "Docker smoke checks passed: clean database startup, restart, pages, WASM, patch, and runtime contents.",
  );
} catch (error) {
  await $`docker logs ${name}`.nothrow();
  throw error;
} finally {
  await $`docker rm --force ${name}`.quiet().nothrow();
}
