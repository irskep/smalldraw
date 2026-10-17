import { z } from "zod";

const noProtoString = z
  .string()
  .min(1)
  .refine(
    (value) => {
      return !value.includes("__proto__");
    },
    {
      message: "String must not include '__proto__'",
    },
  );

export const LoginStartParams = z.object({
  userIdentifier: noProtoString,
  startLoginRequest: noProtoString,
});

export const LoginFinishParams = z.object({
  userIdentifier: noProtoString,
  finishLoginRequest: noProtoString,
});

export const ChangePasswordStartParams = z.object({
  currentPasswordLoginRequest: noProtoString,
  newPasswordRegistrationRequest: noProtoString,
});

export const ChangePasswordFinishParams = z.object({
  currentPasswordFinishRequest: noProtoString,
  newPasswordRegistrationRecord: noProtoString,
});

export const RegisterStartParams = z.object({
  userIdentifier: noProtoString,
  registrationRequest: noProtoString,
});

export const RegisterFinishParams = z.object({
  userIdentifier: noProtoString,
  registrationRecord: noProtoString,
  initialSettings: z
    .object({
      shareMode: z.enum(["private_sync", "pin_required", "allowed"]),
      syncNewDrawingsByDefault: z.boolean(),
      pinChange: z.discriminatedUnion("type", [
        z.object({ type: z.literal("unchanged") }),
        z.object({ type: z.literal("clear") }),
        z.object({ type: z.literal("set"), pin: z.string() }),
      ]),
    })
    .optional(),
});

export const AccountSettingsParams = z.object({
  shareMode: z.enum(["private_sync", "pin_required", "allowed"]),
  syncNewDrawingsByDefault: z.boolean(),
  pinChange: z.discriminatedUnion("type", [
    z.object({ type: z.literal("unchanged") }),
    z.object({ type: z.literal("clear") }),
    z.object({ type: z.literal("set"), pin: z.string() }),
  ]),
});
