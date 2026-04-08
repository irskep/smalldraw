import * as opaque from "@serenity-kit/opaque";
import { getOpaqueServerSetup } from "./getOpaqueServerSetup.js";

export const createOpaqueRegistrationRecord = async ({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<string> => {
  await opaque.ready;
  const { registrationRequest, clientRegistrationState } =
    opaque.client.startRegistration({
      password,
    });
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup: getOpaqueServerSetup(),
    userIdentifier: username,
    registrationRequest,
  });
  const { registrationRecord } = opaque.client.finishRegistration({
    password,
    registrationResponse,
    clientRegistrationState,
  });
  return registrationRecord;
};
