const { getArtists } = require('./get-artists');
const { addTrackToPlaylist } = require('./add-track-to-playlist');
const { createPlaylist } = require('./create-playlist');
const { getArtistId } = require('./get-artist-id');
const { getTopTrackIds } = require('./get-top-track-ids');

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

const nextArtist = (playlistId, artists, index) => {
    if(artists.length <= index) {
        if(nextPlaylist)
            nextPlaylist();
        return;
    }
    const artist = artists[index];
    const cleanName = artist.replaceAll('&','%26').replaceAll('/', '').replaceAll(' ', '%20').replaceAll(';', '').replaceAll('"', '');
    console.log(`Artist ${cleanName} of index ${index}`);
    getArtistId(cleanName).then(id => {
        console.log('Artist id is: ' + id);
        if(!id) {
            nextArtist(playlistId, artists, index+1);
            return;
        }
        getTopTrackIds(id).then(tracks => {
            let tracksString = '';
            const length = Math.min(3,tracks.length);
            for(let i = 0; i < length; i++){
                tracksString += `${tracks[i]}${i < length-1 ? ',' : ''}`;   
            }
            addTrackToPlaylist(playlistId, tracksString)
            .then(() => {
                console.log(`....add tracks ${tracksString} to ${playlistId}`);
                nextArtist(playlistId, artists, index+1);
            })
            .catch(err => {
                console.log('add-track-error: ' + err);
                nextArtist(playlistId, artists, index+1);
            });   
        });
    })
    .catch(err => {
        console.log('artist id-error: ' + err);
        nextArtist(playlistId, artists, index+1);
    });
};

const go = (name, contentUrl) => {
    createPlaylist(name, contentUrl).then(playlistId => {
        console.log('######################');
        console.log('create playlist ' + name);
        getArtists(contentUrl).then(artists => {
            nextArtist(playlistId, artists,0);
        })
        .catch(err => console.log('artist-error: ' + err));
    })
    .catch(err => console.log('playlist-error: ' + err));
};

let nextPlaylist = () => {
    go('FUSION 2018 LIVE', './pageContent/live.html');
    nextPlaylist = () => {
        go('FUSION 2018 BAND', './pageContent/band.html');
        nextPlaylist = () => {
            go('FUSION 2018 DJ', './pageContent/dj.html');
            nextPlaylist = undefined;
        }
    };
}

nextPlaylist();


// USER_ID=sitterhonk TOKEN=BQDyijbVJRRjLKDoX3fFQ0SivHpm0B2TKVlSBmS9m-ICoPxADddQsCOw-VqB2o94zJRKWWHutq2ADl3T2NZJKHYSeal1ih7rLYsgnPO3aiNe2i5psiYXdAQsX1VVvRC4gqfgJogH38f6WiemhykBgJwRVOyoEYNp7hMiJhGdpBVAJdFkbSVr-2TF7rfal9sDrSiSgtI-lrZLrzlcg5h8V464qzBmsRgyK5PiXS7lYd-6HzP28vOq2WZIIcB0KKQDLpEO1Og3zgA4SqY2 node run.js