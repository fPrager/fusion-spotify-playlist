import getClient from "./get-client.ts";

const getTracksInPlaylist = async (playlistId: string) => {
  const client = await getClient();
  const playlist = await client.playlists.get(playlistId);
  if (!playlist) {
    throw new Error("The requested playlist does not exist.");
  }
  const { totalTracks } = playlist;
  const tracks = [];
  for (let i = 0; i < totalTracks % 50; i++) {
    const batch = await client.playlists.getTracks(playlistId, {
      limit: 50,
      offset: 50 * i,
    });
    tracks.push(...batch);
  }
  return tracks;
};

export default getTracksInPlaylist;
