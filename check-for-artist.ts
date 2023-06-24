import getArtistId from "./spotify/get-artitst-id.ts"

const name = "Rosa Anschütz"

const spotifyId = await getArtistId(name)

console.log('got', spotifyId)