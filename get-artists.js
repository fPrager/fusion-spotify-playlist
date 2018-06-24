const { getContent } = require('./get-content');

const getArtists = (url) => {
    return getContent(url)
        .then(content => {
            var artists = [];
            var rec = /<h3 class="(.*)">(.*?)<\/h3>/gm;
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
