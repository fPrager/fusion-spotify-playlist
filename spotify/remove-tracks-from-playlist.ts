import getClient from "./get-client.ts";

const API = "https://api.spotify.com/v1/playlists/PLAYLIST_ID/tracks";

const removeTracksFromPlaylist = async (
  playlistId: string,
  tracks: { uri: string }[],
) => {
  const limit = 50;
  let offset = 0;
  while (offset < tracks.length) {
    const tracksToRemove = tracks.slice(offset, offset + limit);
    await fetch(API.replace("PLAYLIST_ID", playlistId), {
      method: "POST",
      body: JSON.stringify({
        tracks: tracksToRemove.map(({ uri }) => uri),
      }),
      headers: {
        Authentication: `Bearer ${Deno.env.get("TOKEN")}`,
      },
    });

    offset += limit;
  }
};

export default removeTracksFromPlaylist;
