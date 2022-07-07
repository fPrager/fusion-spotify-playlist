const { getContent } = require('./get-content');

const getArtists = (url) => {
    return getContent(url)
        .then(content => {
            var artists = [];
            var rec = /<h4 class="(.*)">(.*?)<\/h4>/gm;
            do {
                m = rec.exec(content);
                if (m) {
                    artists.push(m[2]);
                }
            } while (m);
            return artists;
        });
}

module.exports.getArtists = getArtists;
