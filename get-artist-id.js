const https = require('https');

const getArtistId = (name) => {
    let options = {
        hostname: 'api.spotify.com',
        path: `/v1/search?q=${name}&type=artist`,
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
                    let items = ((result.artists || {}).items || []);
                    if(items.length === 0)
                        resolve(undefined);
                    else
                        resolve(items[0].id);
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

module.exports.getArtistId = getArtistId;