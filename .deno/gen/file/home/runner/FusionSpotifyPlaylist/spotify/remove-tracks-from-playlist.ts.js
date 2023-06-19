const API = "https://api.spotify.com/v1/playlists/PLAYLIST_ID/tracks";
const removeTracksFromPlaylist = async (playlistId, tracks)=>{
    const limit = 50;
    let offset = 0;
    while(offset < tracks.length){
        const tracksToRemove = tracks.slice(offset, offset + limit);
        await fetch(API.replace("PLAYLIST_ID", playlistId), {
            method: "POST",
            body: JSON.stringify({
                tracks: tracksToRemove.map(({ uri  })=>uri)
            }),
            headers: {
                Authentication: `Bearer ${Deno.env.get("TOKEN")}`
            }
        });
        offset += limit;
    }
};
export default removeTracksFromPlaylist;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRnVzaW9uU3BvdGlmeVBsYXlsaXN0L3Nwb3RpZnkvcmVtb3ZlLXRyYWNrcy1mcm9tLXBsYXlsaXN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBnZXRDbGllbnQgZnJvbSBcIi4vZ2V0LWNsaWVudC50c1wiO1xuXG5jb25zdCBBUEkgPSBcImh0dHBzOi8vYXBpLnNwb3RpZnkuY29tL3YxL3BsYXlsaXN0cy9QTEFZTElTVF9JRC90cmFja3NcIjtcblxuY29uc3QgcmVtb3ZlVHJhY2tzRnJvbVBsYXlsaXN0ID0gYXN5bmMgKFxuICBwbGF5bGlzdElkOiBzdHJpbmcsXG4gIHRyYWNrczogeyB1cmk6IHN0cmluZyB9W10sXG4pID0+IHtcbiAgY29uc3QgbGltaXQgPSA1MDtcbiAgbGV0IG9mZnNldCA9IDA7XG4gIHdoaWxlIChvZmZzZXQgPCB0cmFja3MubGVuZ3RoKSB7XG4gICAgY29uc3QgdHJhY2tzVG9SZW1vdmUgPSB0cmFja3Muc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBsaW1pdCk7XG4gICAgYXdhaXQgZmV0Y2goQVBJLnJlcGxhY2UoXCJQTEFZTElTVF9JRFwiLCBwbGF5bGlzdElkKSwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdHJhY2tzOiB0cmFja3NUb1JlbW92ZS5tYXAoKHsgdXJpIH0pID0+IHVyaSksXG4gICAgICB9KSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aGVudGljYXRpb246IGBCZWFyZXIgJHtEZW5vLmVudi5nZXQoXCJUT0tFTlwiKX1gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIG9mZnNldCArPSBsaW1pdDtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgcmVtb3ZlVHJhY2tzRnJvbVBsYXlsaXN0O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE1BQU0sTUFBTTtBQUVaLE1BQU0sMkJBQTJCLE9BQy9CLFlBQ0EsU0FDRztJQUNILE1BQU0sUUFBUTtJQUNkLElBQUksU0FBUztJQUNiLE1BQU8sU0FBUyxPQUFPLE1BQU0sQ0FBRTtRQUM3QixNQUFNLGlCQUFpQixPQUFPLEtBQUssQ0FBQyxRQUFRLFNBQVM7UUFDckQsTUFBTSxNQUFNLElBQUksT0FBTyxDQUFDLGVBQWUsYUFBYTtZQUNsRCxRQUFRO1lBQ1IsTUFBTSxLQUFLLFNBQVMsQ0FBQztnQkFDbkIsUUFBUSxlQUFlLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBRyxFQUFFLEdBQUs7WUFDMUM7WUFDQSxTQUFTO2dCQUNQLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQ25EO1FBQ0Y7UUFFQSxVQUFVO0lBQ1o7QUFDRjtBQUVBLGVBQWUseUJBQXlCIn0=