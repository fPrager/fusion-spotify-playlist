import getClient from "./get-client.ts";

const addTracksToPlaylist = async (
  playlistId: string,
  tracks: { uri: string }[],
) => {
  const client = await getClient();
  const limit = 50;
  let offset = 0;
  while (offset < tracks.length) {
    const tracksToAdd = tracks.slice(offset, offset + limit);
    await client.playlists.addItems(
      playlistId,
      tracksToAdd.map(({ uri }) => uri),
    );
    offset += limit;
  }
};

export default addTracksToPlaylist;
