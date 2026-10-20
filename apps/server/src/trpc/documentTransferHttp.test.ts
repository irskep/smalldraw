import { expect, test } from "bun:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import * as A from "@automerge/automerge";
import {
  cbor,
  generateAutomergeUrl,
  parseAutomergeUrl,
} from "@automerge/automerge-repo";
import express from "express";
import { documentLifetime, repo } from "../automergeRepo/automergeRepo";
import { createSession } from "../db/createSession";
import { createUser } from "../db/createUser";
import { createDocumentTransferHttp } from "./documentTransferHttp";

test("binary HTTP guest and account transfers preserve bytes, authorization, retries and cold loads", async () => {
  const app = express();
  app.use("/documents", createDocumentTransferHttp());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/documents`;
  async function request(operation: string, input: unknown, auth?: string) {
    const response = await fetch(`${origin}/${operation}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/cbor",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: cbor.encode(input) as Uint8Array<ArrayBuffer>,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const envelope = cbor.decode(
      new Uint8Array(await response.arrayBuffer()),
    ) as any;
    return { status: response.status, ...envelope };
  }
  const local = A.from({
    marks: ["first"],
    points: new A.ImmutableString("x".repeat(100000)),
  });
  try {
    const { documentId } = parseAutomergeUrl(generateAutomergeUrl());
    const input = {
      documentId,
      deviceTag: "test-device",
      content: A.save(local),
    };
    const registered = await request("registerCollaborativeDocument", input);
    expect(registered.status).toBe(200);
    const retry = await request("registerCollaborativeDocument", input);
    expect(retry.result).toEqual(registered.result);
    expect(
      (
        await request("registerCollaborativeDocument", {
          ...input,
          deviceTag: "stranger",
        })
      ).status,
    ).toBe(403);
    await documentLifetime.use(documentId, async () => {
      await repo.flush([documentId]);
      await repo.removeFromCache(documentId);
    });
    const resolved = await request("resolveAnonymousCollaborativeDocument", {
      joinSecret: registered.result.joinSecret,
      deviceTag: "reader",
    });
    expect(resolved.result.content).toBeInstanceOf(Uint8Array);
    const remote = A.load<typeof local>(resolved.result.content);
    expect(remote.points.toString()).toBe(local.points.toString());
    A.free(remote);
    expect(
      (
        await request("resolveAnonymousCollaborativeDocument", {
          joinSecret: "missing",
          deviceTag: "reader",
        })
      ).result,
    ).toBeNull();
    expect(
      (
        await request("registerAccountSyncedDocument", {
          accountId: "x",
          documentId,
          content: A.save(local),
        })
      ).status,
    ).toBe(401);
    const user = await createUser({
      username: "binary-account",
      registrationRecord: "test",
    });
    await createSession({ sessionKey: "binary-session", userId: user.id });
    const accountId = parseAutomergeUrl(generateAutomergeUrl()).documentId;
    expect(
      (
        await request(
          "registerAccountSyncedDocument",
          { accountId: user.id, documentId: accountId, content: A.save(local) },
          "binary-session",
        )
      ).status,
    ).toBe(200);
    const checkpoint = await request(
      "checkpointAccountDrawing",
      { accountId: user.id, documentId: accountId, content: A.save(local) },
      "binary-session",
    );
    expect(checkpoint.status).toBe(200);
    expect(checkpoint.result.heads).toEqual(A.getHeads(local));
    expect(checkpoint.result.content).toBeInstanceOf(Uint8Array);
    expect(
      (
        await request(
          "resolveAccountCollaborativeDocument",
          { documentId: accountId, deviceTag: "reader" },
          "binary-session",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request("resolveAccountCollaborativeDocument", {
          documentId: accountId,
          deviceTag: "reader",
        })
      ).status,
    ).toBe(401);
    expect((await request("toString", {})).status).toBe(404);
    expect(
      (
        await request("registerCollaborativeDocument", {
          ...input,
          content: "base64",
        })
      ).status,
    ).toBe(400);
  } finally {
    A.free(local);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
