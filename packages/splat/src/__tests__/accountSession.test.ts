import { expect, test } from "bun:test";
import { createAccountSession } from "../app/createAccountSession";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("account refresh distinguishes guest, signed-in, and unavailable without inventing logout", async () => {
  let user: { id: string; username: string } | null = null;
  let fail = false;
  let changed = 0;
  const session = createAccountSession({
    client: {
      async getCurrentAccount() {
        if (fail) throw new Error("Offline");
        return user;
      },
      async signOut() {},
    },
    navigateToSignIn() {},
    onSignedOut() {},
    onIdentityChanged() {
      changed++;
    },
  });
  await session.refresh();
  expect(session.$state.get().status).toBe("signed-out");
  expect(changed).toBe(0);
  user = { id: "user", username: "Pat" };
  await session.refresh();
  expect(session.$state.get().username).toBe("Pat");
  expect(changed).toBe(1);
  fail = true;
  await session.refresh();
  expect(session.$state.get().status).toBe("unavailable");
  expect(changed).toBe(1);
  fail = false;
  await session.refresh();
  expect(session.$state.get().status).toBe("signed-in");
  expect(changed).toBe(1);
  session.dispose();
});

test("in-flight account checks cannot resurrect a signed-out or disposed session", async () => {
  const response = deferred<{ id: string; username: string } | null>();
  let calls = 0,
    signedOut = 0;
  const session = createAccountSession({
    client: {
      getCurrentAccount() {
        calls++;
        return response.promise;
      },
      async signOut() {},
    },
    navigateToSignIn() {},
    onSignedOut() {
      signedOut++;
    },
    onIdentityChanged() {},
  });
  const first = session.refresh();
  const second = session.refresh();
  expect(calls).toBe(1);
  await session.signOut();
  response.resolve({ id: "old", username: "Old account" });
  await Promise.all([first, second]);
  expect(session.$state.get().status).toBe("signed-out");
  expect(signedOut).toBe(1);
  session.dispose();
  await session.refresh();
  expect(calls).toBe(1);
});

test("failed logout keeps account identity and exposes a retryable error", async () => {
  let navigated = false;
  const session = createAccountSession({
    client: {
      async getCurrentAccount() {
        return { id: "user", username: "Pat" };
      },
      async signOut() {
        throw new Error("Offline");
      },
    },
    navigateToSignIn() {},
    onSignedOut() {
      navigated = true;
    },
    onIdentityChanged() {},
  });
  await session.refresh();
  await session.signOut();
  expect(session.$state.get()).toEqual({
    status: "signed-in",
    userId: "user",
    username: "Pat",
    busy: false,
    error: "Offline",
  });
  expect(navigated).toBe(false);
  session.dispose();
});

test("cancelling sign-out keeps the account without a misleading error", async () => {
  let signedOut = false;
  const session = createAccountSession({
    client: {
      getCurrentAccount: async () => ({ id: "parent", username: "Parent" }),
      signOut: async () => {
        signedOut = true;
      },
    },
    navigateToSignIn() {},
    onSignedOut() {},
    onIdentityChanged() {},
    confirmSignOut: async () => false,
  });
  await session.refresh();
  await session.signOut();
  expect(signedOut).toBe(false);
  expect(session.$state.get().status).toBe("signed-in");
  expect(session.$state.get().error).toBeNull();
  session.dispose();
});
