import getClient from "./get-client.ts";
const getTracksInPlaylist = async (playlistId)=>{
    const client = await getClient();
    const playlist = await client.playlists.get(playlistId);
    if (!playlist) {
        throw new Error("The requested playlist does not exist.");
    }
    const { totalTracks  } = playlist;
    const tracks = [];
    for(let i = 0; i < totalTracks % 50; i++){
        const batch = await client.playlists.getTracks(playlistId, {
            limit: 50,
            offset: 50 * i
        });
        tracks.push(...batch);
    }
    return tracks;
};
export default getTracksInPlaylist;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRnVzaW9uU3BvdGlmeVBsYXlsaXN0L3Nwb3RpZnkvZ2V0LXRyYWNrcy1pbi1wbGF5bGlzdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZ2V0Q2xpZW50IGZyb20gXCIuL2dldC1jbGllbnQudHNcIjtcblxuY29uc3QgZ2V0VHJhY2tzSW5QbGF5bGlzdCA9IGFzeW5jIChwbGF5bGlzdElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0Q2xpZW50KCk7XG4gIGNvbnN0IHBsYXlsaXN0ID0gYXdhaXQgY2xpZW50LnBsYXlsaXN0cy5nZXQocGxheWxpc3RJZCk7XG4gIGlmICghcGxheWxpc3QpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVxdWVzdGVkIHBsYXlsaXN0IGRvZXMgbm90IGV4aXN0LlwiKTtcbiAgfVxuICBjb25zdCB7IHRvdGFsVHJhY2tzIH0gPSBwbGF5bGlzdDtcbiAgY29uc3QgdHJhY2tzID0gW107XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdG90YWxUcmFja3MgJSA1MDsgaSsrKSB7XG4gICAgY29uc3QgYmF0Y2ggPSBhd2FpdCBjbGllbnQucGxheWxpc3RzLmdldFRyYWNrcyhwbGF5bGlzdElkLCB7XG4gICAgICBsaW1pdDogNTAsXG4gICAgICBvZmZzZXQ6IDUwICogaSxcbiAgICB9KTtcbiAgICB0cmFja3MucHVzaCguLi5iYXRjaCk7XG4gIH1cbiAgcmV0dXJuIHRyYWNrcztcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGdldFRyYWNrc0luUGxheWxpc3Q7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUFlLGtCQUFrQjtBQUV4QyxNQUFNLHNCQUFzQixPQUFPLGFBQXVCO0lBQ3hELE1BQU0sU0FBUyxNQUFNO0lBQ3JCLE1BQU0sV0FBVyxNQUFNLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQztJQUM1QyxJQUFJLENBQUMsVUFBVTtRQUNiLE1BQU0sSUFBSSxNQUFNLDBDQUEwQztJQUM1RCxDQUFDO0lBQ0QsTUFBTSxFQUFFLFlBQVcsRUFBRSxHQUFHO0lBQ3hCLE1BQU0sU0FBUyxFQUFFO0lBQ2pCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxjQUFjLElBQUksSUFBSztRQUN6QyxNQUFNLFFBQVEsTUFBTSxPQUFPLFNBQVMsQ0FBQyxTQUFTLENBQUMsWUFBWTtZQUN6RCxPQUFPO1lBQ1AsUUFBUSxLQUFLO1FBQ2Y7UUFDQSxPQUFPLElBQUksSUFBSTtJQUNqQjtJQUNBLE9BQU87QUFDVDtBQUVBLGVBQWUsb0JBQW9CIn0=