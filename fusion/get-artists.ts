const getArtists = async (url: string): Promise<string[]> => {
  const response = await fetch(url);
  const pageContent = await response.text();
  const artists: string[] = [];
  const rec = /<h4 class="(.*)">(.*?)<\/h4>/gm;
  let match: null | RegExpExecArray = null;
  do {
    match = rec.exec(pageContent);
    if (match) {
      artists.push(match[2]);
    }
  } while (match);
  return artists;
};

export default getArtists;
