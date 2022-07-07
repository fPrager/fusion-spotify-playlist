const https = require('https');

const getArtistId = (name) => {
    console.log('encoded', encodeURI(name))
    let options = {
        hostname: 'api.spotify.com',
        path: `/v1/search?q=${encodeURI(name)}&type=artist`,
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
                    const artistItem = items.find((item) => item.name.toLowerCase() === name.toLowerCase())
                    if(!artistItem) {
                        console.warn('no found for', name)
                        resolve(undefined)
                    } 
                    else {
                        resolve(artistItem.id)
                    }
                }
                catch(err){
                    reject('parse error', err);
                }                
            })
            res.on('error', function(e) {
               reject('responded with', e.message);
            });
        });
    });
}

module.exports.getArtistId = getArtistId;