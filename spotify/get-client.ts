import { Client } from "npm:spotify-api.js@9.2.5";
import getTokenFromEnv from "../get-token-from-env.ts";

let client: Client | null = null;

const getClient = async () => {
  if (!client) {
    const token = await getTokenFromEnv();
    client = await Client.create({
      token,
    });
  }

  return client;
};

export default getClient;
