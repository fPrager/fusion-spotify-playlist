const PLAYLIST_MAP = {
  'FUSION 2023 DJ': {
    url: 'https://www.fusion-festival.de/de/2023/programm/dj',
    id: null,
  },
  'FUSION 2023 BAND': {
    url: 'https://www.fusion-festival.de/de/2023/programm/band',
    id: null,
  },
  'FUSION 2023 LIVE': {
    url: 'https://www.fusion-festival.de/de/2023/programm/live-act',
    id: null,
  }
}

export type PlaylistName = keyof typeof PLAYLIST_MAP

export default PLAYLIST_MAP