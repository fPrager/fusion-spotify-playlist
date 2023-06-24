import getTokenFromEnv from "../get-token-from-env.ts";
import getClient from "./get-client.ts";

const API = "https://api.spotify.com/v1/playlists/PLAYLIST_ID";

const updatePlaylistInfo = async (playlistId: string, missingArtists: string[]) => {
  const token = await getTokenFromEnv()
  const respone = await fetch(API.replace("PLAYLIST_ID", playlistId), {
    method: "PUT",
    body: JSON.stringify({
      description:
      `This is a playlist generated from the Fusion program page - last updated: ${new Date(Date.now()).toLocaleDateString()} ${new Date(Date.now()).toLocaleTimeString()} 
      The script just reads the artist's names from fusion page and tries to find an exact match in Spotify.
      So don't wonder if not all artists are present in this list or if the artist is actually mixed with someone else.
      These artists are missing: ${missingArtists.map((name) => `${name}, `)}`,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await respone.text()
  if(respone.status !== 200) {
    throw new Error(`Unable to update playlist ${text}`)
  } else {
    console.log('response: ', text)
  }
}

export default updatePlaylistInfo;
