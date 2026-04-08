import * as opaque from "@serenity-kit/opaque";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";

export const createBasicAuthHeader = (
  username: string,
  password: string,
): string => {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
};

const createClient = (authorization?: string) =>
  createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: process.env.SMALLDRAW_API_URL ?? "http://localhost:3030/api",
        headers: authorization
          ? {
              authorization,
            }
          : undefined,
      }),
    ],
  });

export const signupWithPassword = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}) => {
  await opaque.ready;
  const client = createClient();
  const { registrationRequest, clientRegistrationState } =
    opaque.client.startRegistration({
      password,
    });
  const startResult = await client.mutation("registerStart", {
    userIdentifier: username,
    registrationRequest,
  });
  const registrationResponse = (startResult as { registrationResponse: string })
    .registrationResponse;
  const { registrationRecord } = opaque.client.finishRegistration({
    password,
    registrationResponse,
    clientRegistrationState,
  });
  await client.mutation("registerFinish", {
    userIdentifier: username,
    registrationRecord,
  });
  return { username };
};

export const fetchAdminMe = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}) => {
  const client = createClient(createBasicAuthHeader(username, password));
  return await client.query("adminMe");
};

export const fetchAdminUserByUsername = async ({
  adminUsername,
  adminPassword,
  username,
}: {
  adminUsername: string;
  adminPassword: string;
  username: string;
}) => {
  const client = createClient(
    createBasicAuthHeader(adminUsername, adminPassword),
  );
  return await client.query("adminGetUserByUsername", username);
};

const requireValue = (value: string | undefined, name: string): string => {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const runCli = async (argv: string[]): Promise<unknown> => {
  const [command, subcommand, ...rest] = argv;

  if (command === "signup") {
    const username =
      rest[0] ??
      process.env.SMALLDRAW_SIGNUP_USERNAME ??
      process.env.ADMIN_USERNAME;
    const password =
      rest[1] ??
      process.env.SMALLDRAW_SIGNUP_PASSWORD ??
      process.env.ADMIN_PASSWORD;
    return await signupWithPassword({
      username: requireValue(username, "signup username"),
      password: requireValue(password, "signup password"),
    });
  }

  if (command === "admin" && subcommand === "me") {
    return await fetchAdminMe({
      username: requireValue(
        process.env.SMALLDRAW_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME,
        "admin username",
      ),
      password: requireValue(
        process.env.SMALLDRAW_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD,
        "admin password",
      ),
    });
  }

  if (command === "admin" && subcommand === "get-user") {
    return await fetchAdminUserByUsername({
      adminUsername: requireValue(
        process.env.SMALLDRAW_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME,
        "admin username",
      ),
      adminPassword: requireValue(
        process.env.SMALLDRAW_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD,
        "admin password",
      ),
      username: requireValue(rest[0], "target username"),
    });
  }

  throw new Error(
    "Usage: signup <username> <password> | admin me | admin get-user <username>",
  );
};
