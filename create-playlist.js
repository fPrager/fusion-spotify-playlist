const https = require('https');

const createPlaylist = (name) => {
    var postData = {
        name,
        public : true,
        description : 'a fusion line up'
    };

    console.log(process.env.TOKEN);
    let options = {
        hostname: 'api.spotify.com',
        path: `/v1/users/${process.env.USER_ID}/playlists`,
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
                let result = JSON.parse(body);
                if(!result.id)
                    reject(result);
                else
                    resolve(result.id);
            })
            res.on('error', function(e) {
               reject(e);
            });
        });

        req.write(JSON.stringify(postData));
        req.end();
    });
}

module.exports.createPlaylist = createPlaylist;
