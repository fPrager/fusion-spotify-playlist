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
    console.log(`Artist ${artist} of index ${index}`);
    getArtistId(artist).then(id => {
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
    go('FUSION 2022 DJ', './pageContent/dj.html');
    nextPlaylist = undefined;
}

console.log('run with', process.env.USER_ID, process.env.TOKEN)

nextPlaylist();


// node USER_ID=sitterhonk TOKEN=BQAyRdFwlfJS4JrfW5JoPBgj1P5i_tLg6bZQbsUij0cPw4Cvx-OWq2qZKLyi35e-_LDGwDq45rREjeAG5cOjog74t9HPyP7QyfNIVTq3C2fWpu82zKCTcfYsbtf3_2xkAUFskME-0vxkXgr6apveTPKOcSbFUhGDFSiMBt3WS9aeo6RrxudIVWUmJ4_vAffDXoCF63pUJpE_zIBsQGL_x2heqwGGblPDLVIk1lIXdC-M9Hc9XKDHQF-ofHtW72WszEWqQcmA7rZWafmQxiAJhG6uGjMw43fsBNo8TxPzJ071bRzGrk-zRg run.js