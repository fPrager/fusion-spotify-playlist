import { Client } from "npm:spotify-api.js@9.2.5";

let client: Client | null = null;

const getClient = async () => {
  if (!client) {
    const token = Deno.env.get("TOKEN");
    if (!token) {
      throw new Error("Missing token in env. To get a token, visit the Spotify Developer portal, test the api by create a playlist and use that bearer token here (without Bearer prefix).");
    }

    client = await Client.create({
      token,
    });
  }

  return client;
};

/**
curl --request GET \
  --url https://api.spotify.com/v1/users/sitterhonk/playlists \
  --header 'Authorization: Bearer BQBSJw...qbFGp6'
*/

export default getClient;
