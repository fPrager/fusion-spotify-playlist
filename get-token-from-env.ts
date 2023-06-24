import { load } from "https://deno.land/std/dotenv/mod.ts";

const getTokenFromEnv = async () => {
    const env = await load();
    const token = env["TOKEN"];
    if (!token) {
      throw new Error("Missing token in env. To get a token, visit the Spotify Developer portal, test the api by create a playlist and use that bearer token here (without Bearer prefix).");
    }
    return token;
}

export default getTokenFromEnv;