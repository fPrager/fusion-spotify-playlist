const https = require('https');

const getTopTrackIds = (artistId) => {
    let options = {
        hostname: 'api.spotify.com',
        path: `/v1/artists/${artistId}/top-tracks?country=DE`,
        headers: {
            'Authorization': `Bearer ${process.env.TOKEN}`
         }  
    };
    return new Promise((resolve, reject) => {
        https.get(options, function(res){
            var body = "";
            res.on('data', function(data) {
               body += data;
            });
            res.on('end', function() {
                try{
                    let result = JSON.parse(body);
                    let tracks = (result.tracks || []);
                    const uris = tracks.reduce((list, track) => {
                        if(!track.uri)
                            return list;
                        list.push(track.uri);
                        return list;
                    }, []);
                    resolve(uris);
                }
                catch(err){
                    reject('parse error');
                }
            })
            res.on('error', function(e) {
               reject(e.message);
            });
        });
    });
}

module.exports.getTopTrackIds = getTopTrackIds;
