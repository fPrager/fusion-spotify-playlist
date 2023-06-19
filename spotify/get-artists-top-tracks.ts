import getClient from "./get-client.ts";

const TOP_X_TRACKS = 3;

const getArtistsTopTracks = async (artistId: string) => {
  const client = await getClient();
  const topTracks = (await client.artists.getTopTracks(artistId)).slice(
    0,
    TOP_X_TRACKS,
  );
  return topTracks;
};

export default getArtistsTopTracks;
