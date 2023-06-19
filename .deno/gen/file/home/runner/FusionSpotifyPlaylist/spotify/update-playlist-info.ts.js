import getClient from "./get-client.ts";
const updatePlaylistInfo = async (playlistId)=>{
    const client = await getClient();
    await client.playlists.edit(playlistId, {
        description: `This is a playlist generated from the Fusion program page. Last updated: ${new Date(Date.now()).toDateString()}`
    });
};
export default updatePlaylistInfo;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRnVzaW9uU3BvdGlmeVBsYXlsaXN0L3Nwb3RpZnkvdXBkYXRlLXBsYXlsaXN0LWluZm8udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGdldENsaWVudCBmcm9tIFwiLi9nZXQtY2xpZW50LnRzXCI7XG5cbmNvbnN0IHVwZGF0ZVBsYXlsaXN0SW5mbyA9IGFzeW5jIChwbGF5bGlzdElkOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2xpZW50ID0gYXdhaXQgZ2V0Q2xpZW50KCk7XG4gIGF3YWl0IGNsaWVudC5wbGF5bGlzdHMuZWRpdChwbGF5bGlzdElkLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICBgVGhpcyBpcyBhIHBsYXlsaXN0IGdlbmVyYXRlZCBmcm9tIHRoZSBGdXNpb24gcHJvZ3JhbSBwYWdlLiBMYXN0IHVwZGF0ZWQ6ICR7XG4gICAgICAgIG5ldyBEYXRlKERhdGUubm93KCkpLnRvRGF0ZVN0cmluZygpXG4gICAgICB9YCxcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCB1cGRhdGVQbGF5bGlzdEluZm87XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxlQUFlLGtCQUFrQjtBQUV4QyxNQUFNLHFCQUFxQixPQUFPLGFBQXVCO0lBQ3ZELE1BQU0sU0FBUyxNQUFNO0lBQ3JCLE1BQU0sT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVk7UUFDdEMsYUFDRSxDQUFDLHlFQUF5RSxFQUN4RSxJQUFJLEtBQUssS0FBSyxHQUFHLElBQUksWUFBWSxHQUNsQyxDQUFDO0lBQ047QUFDRjtBQUVBLGVBQWUsbUJBQW1CIn0=