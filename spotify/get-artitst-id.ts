import getClient from "./get-client.ts";

const getArtistId = async (name: string): Promise<string | null> => {
  const client = await getClient();
  const matches = await client.artists.search(name);
  const artist = matches.find(({ name: otherName }) =>
    otherName.toLocaleLowerCase() === name.toLocaleLowerCase()
  );
  if (!artist) {
    console.warn(
      `...no spotify profile found for '${name}'. Only found ${
        matches.map(({ name: otherName }) => `${otherName}, `)
      }`,
    );
    return null;
  }
  return artist.id;
};

export default getArtistId;
