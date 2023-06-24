import { PlaylistName } from "../playlist.ts";
import getClient from "./get-client.ts";
import getUserId from "./get-user-id.ts";

const PLAYLIST_FILE = "existing_playlists.json";

type PlaylistId = {
  id: string;
  name: string;
};

const getPlaylistId = async (name: PlaylistName) => {
  let fileContent = null;
  try {
    fileContent = await Deno.readTextFile(PLAYLIST_FILE);
  } catch (e) {
    fileContent = "[]";
  }

  const existingPlaylists = JSON.parse(fileContent) as PlaylistId[];
  const matchingPlaylist = existingPlaylists.find(({ name: existingName }) =>
    existingName === name
  );
  
  if (!matchingPlaylist) {
    const client = await getClient();
    const newPlaylist = await client.playlists.create(getUserId(), {
      name,
    });
    if(!newPlaylist) {
      throw new Error('error while creating the playlist')
    }
    await Deno.writeTextFile(
      PLAYLIST_FILE,
      JSON.stringify([...existingPlaylists, {
        id: newPlaylist.id,
        name,
      }]),
    );
    return newPlaylist.id;
  }

  return matchingPlaylist.id
};

export default getPlaylistId;
