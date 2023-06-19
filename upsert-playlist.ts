import getArtists from "./fusion/get-artists.ts";
import { PlaylistName } from "./playlist.ts";
import PLAYLIST_MAP from "./playlist.ts";
import addTracksToPlaylist from "./spotify/add-tracks-to-playlist.ts";
import getArtistsTopTracks from "./spotify/get-artists-top-tracks.ts";
import getArtistId from "./spotify/get-artitst-id.ts";
import getPlaylistId from "./spotify/get-playlist-id.ts";
import getTracksInPlaylist from "./spotify/get-tracks-in-playlist.ts";
import removeTracksFromPlaylist from "./spotify/remove-tracks-from-playlist.ts";
import updatePlaylistInfo from "./spotify/update-playlist-info.ts";

const upsertPlaylist = async (name: PlaylistName) => {
  const playlistId = await getPlaylistId(name);
  const existingTracks = await getTracksInPlaylist(playlistId);
  console.log(`... got ${existingTracks.length} existing tracks`)
  const artistsToAdd = await getArtists(PLAYLIST_MAP[name].url);
  console.log(`... artists on page ${artistsToAdd}`)
  const tracksForPlaylist = await artistsToAdd.reduce(
    async (tracks, artistName) => {
      const spotifyId = await getArtistId(artistName);
      if (!spotifyId) {
        return tracks;
      }
      return [...(await tracks), ...(await getArtistsTopTracks(spotifyId))];
    },
    Promise.resolve([] as { uri: string }[]),
  );
  const tracksToRemove = existingTracks.filter(
    ({ track }) =>
      track &&
      !tracksForPlaylist.some(({ uri: wantedUri }) => wantedUri === track.uri),
  ).map(({ track }) => track);

  const tracksToAdd = tracksForPlaylist.filter(({ uri }) =>
    !existingTracks.some(({ track }) => track && track.uri === uri)
  );

  console.log(
    `...remove ${tracksToRemove.length} tracks of artists, that are not present anymore`,
  );
  // @ts-expect-error
  await removeTracksFromPlaylist(playlistId, tracksToRemove);
  console.log(
    `...add ${tracksToAdd.length} tracks of artists, that are not in list yet`,
  );
  await addTracksToPlaylist(playlistId, tracksToAdd);
  console.log(`...update playlist info`);
  await updatePlaylistInfo(playlistId);

  console.log(`done for ${name}✔️`);
};

export default upsertPlaylist;
