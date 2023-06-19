import getClient from "./get-client.ts";

const updatePlaylistInfo = async (playlistId: string) => {
  const client = await getClient();
  await client.playlists.edit(playlistId, {
    description:
      `This is a playlist generated from the Fusion program page. Last updated: ${
        new Date(Date.now()).toDateString()
      }`,
  });
};

export default updatePlaylistInfo;
