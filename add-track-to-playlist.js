const https = require('https');

const addTrackToPlaylist = (playlistId, trackId) => {
    let options = {
        hostname: 'api.spotify.com',
        path: `/v1/users/${process.env.USER_ID}/playlists/${playlistId}/tracks?uris=${trackId}`,
        headers: {
            'Authorization': `Bearer ${process.env.TOKEN}`
        },
        method: 'POST'
    };
    return new Promise((resolve, reject) => {
        var req = https.request(options, function(res){
            var body = "";
            res.on('data', function(data) {
               body += data;
            });
            res.on('end', function() {
                resolve();
            })
            res.on('error', function(e) {
               reject(e.message);
            });
        });

        req.end();
    });
}

module.exports.addTrackToPlaylist = addTrackToPlaylist;
