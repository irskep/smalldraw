import type { AccountSettings, AccountSettingsInput } from "@smalldraw/shared";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { accountSettings } from "./schema.js";

const PIN_SALT_BYTES = 16;

type AccountSettingsRow = typeof accountSettings.$inferSelect;

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = Object.freeze({
  shareMode: "allowed",
  hasPin: false,
});

export async function getAccountSettings(
  userId: string,
): Promise<AccountSettings> {
  const row = await getAccountSettingsRow(userId);
  if (!row) {
    return { ...DEFAULT_ACCOUNT_SETTINGS };
  }
  return toAccountSettings(row);
}

export async function saveAccountSettings(
  userId: string,
  input: AccountSettingsInput,
): Promise<AccountSettings> {
  const current = await getAccountSettingsRow(userId);
  const pinUpdate = await resolvePinUpdate(current, input);
  if (input.shareMode === "pin_required" && !pinUpdate.pinHash) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A PIN is required before sharing can require a PIN",
    });
  }
  await db
    .insert(accountSettings)
    .values({
      userId,
      shareMode: input.shareMode,
      ...pinUpdate,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: accountSettings.userId,
      set: {
        shareMode: input.shareMode,
        ...pinUpdate,
        updatedAt: new Date(),
      },
    });
  return await getAccountSettings(userId);
}

export async function verifyAccountSettingsPin(
  userId: string,
  pin: string,
): Promise<boolean> {
  const row = await getAccountSettingsRow(userId);
  if (!row?.pinHash || !row.pinSalt) {
    return false;
  }
  return (await hashPin(pin.trim(), row.pinSalt)) === row.pinHash;
}

async function getAccountSettingsRow(
  userId: string,
): Promise<AccountSettingsRow | null> {
  const [row] = await db
    .select()
    .from(accountSettings)
    .where(eq(accountSettings.userId, userId));
  return row ?? null;
}

function toAccountSettings(row: AccountSettingsRow): AccountSettings {
  return {
    shareMode:
      row.shareMode === "private_sync" || row.shareMode === "pin_required"
        ? row.shareMode
        : "allowed",
    hasPin: Boolean(row.pinHash && row.pinSalt),
  };
}

async function resolvePinUpdate(
  current: AccountSettingsRow | null,
  input: AccountSettingsInput,
): Promise<{ pinHash: string | null; pinSalt: string | null }> {
  if (input.pinChange.type === "unchanged") {
    return {
      pinHash: current?.pinHash ?? null,
      pinSalt: current?.pinSalt ?? null,
    };
  }
  if (input.pinChange.type === "clear") {
    return { pinHash: null, pinSalt: null };
  }
  const pin = input.pinChange.pin.trim();
  if (!pin) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "PIN is required" });
  }
  const pinSalt = createSalt();
  return {
    pinHash: await hashPin(pin, pinSalt),
    pinSalt,
  };
}

function createSalt(): string {
  const bytes = new Uint8Array(PIN_SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const input = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
