import getClient from "./get-client.ts";
import getUserId from "./get-user-id.ts";
const PLAYLIST_FILE = "existing_playlists.json";
const getPlaylistId = async (name)=>{
    let fileContent = null;
    try {
        fileContent = await Deno.readTextFile(PLAYLIST_FILE);
    } catch (e) {
        fileContent = "[]";
    }
    const existingPlaylists = JSON.parse(fileContent);
    const matchingPlaylist = existingPlaylists.find(({ name: existingName  })=>existingName === name);
    if (!matchingPlaylist) {
        const client = await getClient();
        const newPlaylist = await client.playlists.create(getUserId(), {
            name
        });
        if (!newPlaylist) {
            throw new Error('error while creating the playlist');
        }
        console.log(newPlaylist);
        await Deno.writeTextFile(PLAYLIST_FILE, JSON.stringify([
            ...existingPlaylists,
            {
                id: newPlaylist.id,
                name
            }
        ]));
        return newPlaylist.id;
    }
    return matchingPlaylist.id;
};
export default getPlaylistId;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRnVzaW9uU3BvdGlmeVBsYXlsaXN0L3Nwb3RpZnkvZ2V0LXBsYXlsaXN0LWlkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBsYXlsaXN0TmFtZSB9IGZyb20gXCIuLi9wbGF5bGlzdC50c1wiO1xuaW1wb3J0IGdldENsaWVudCBmcm9tIFwiLi9nZXQtY2xpZW50LnRzXCI7XG5pbXBvcnQgZ2V0VXNlcklkIGZyb20gXCIuL2dldC11c2VyLWlkLnRzXCI7XG5cbmNvbnN0IFBMQVlMSVNUX0ZJTEUgPSBcImV4aXN0aW5nX3BsYXlsaXN0cy5qc29uXCI7XG5cbnR5cGUgUGxheWxpc3RJZCA9IHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufTtcblxuY29uc3QgZ2V0UGxheWxpc3RJZCA9IGFzeW5jIChuYW1lOiBQbGF5bGlzdE5hbWUpID0+IHtcbiAgbGV0IGZpbGVDb250ZW50ID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBmaWxlQ29udGVudCA9IGF3YWl0IERlbm8ucmVhZFRleHRGaWxlKFBMQVlMSVNUX0ZJTEUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZmlsZUNvbnRlbnQgPSBcIltdXCI7XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1BsYXlsaXN0cyA9IEpTT04ucGFyc2UoZmlsZUNvbnRlbnQpIGFzIFBsYXlsaXN0SWRbXTtcbiAgY29uc3QgbWF0Y2hpbmdQbGF5bGlzdCA9IGV4aXN0aW5nUGxheWxpc3RzLmZpbmQoKHsgbmFtZTogZXhpc3RpbmdOYW1lIH0pID0+XG4gICAgZXhpc3RpbmdOYW1lID09PSBuYW1lXG4gICk7XG4gIFxuICBpZiAoIW1hdGNoaW5nUGxheWxpc3QpIHtcbiAgICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRDbGllbnQoKTtcbiAgICBjb25zdCBuZXdQbGF5bGlzdCA9IGF3YWl0IGNsaWVudC5wbGF5bGlzdHMuY3JlYXRlKGdldFVzZXJJZCgpLCB7XG4gICAgICBuYW1lLFxuICAgIH0pO1xuICAgIGlmKCFuZXdQbGF5bGlzdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdlcnJvciB3aGlsZSBjcmVhdGluZyB0aGUgcGxheWxpc3QnKVxuICAgIH1cbiAgICBjb25zb2xlLmxvZyhuZXdQbGF5bGlzdCk7XG4gICAgYXdhaXQgRGVuby53cml0ZVRleHRGaWxlKFxuICAgICAgUExBWUxJU1RfRklMRSxcbiAgICAgIEpTT04uc3RyaW5naWZ5KFsuLi5leGlzdGluZ1BsYXlsaXN0cywge1xuICAgICAgICBpZDogbmV3UGxheWxpc3QuaWQsXG4gICAgICAgIG5hbWUsXG4gICAgICB9XSksXG4gICAgKTtcbiAgICByZXR1cm4gbmV3UGxheWxpc3QuaWQ7XG4gIH1cblxuICByZXR1cm4gbWF0Y2hpbmdQbGF5bGlzdC5pZFxufTtcblxuZXhwb3J0IGRlZmF1bHQgZ2V0UGxheWxpc3RJZDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLGVBQWUsa0JBQWtCO0FBQ3hDLE9BQU8sZUFBZSxtQkFBbUI7QUFFekMsTUFBTSxnQkFBZ0I7QUFPdEIsTUFBTSxnQkFBZ0IsT0FBTyxPQUF1QjtJQUNsRCxJQUFJLGNBQWMsSUFBSTtJQUN0QixJQUFJO1FBQ0YsY0FBYyxNQUFNLEtBQUssWUFBWSxDQUFDO0lBQ3hDLEVBQUUsT0FBTyxHQUFHO1FBQ1YsY0FBYztJQUNoQjtJQUVBLE1BQU0sb0JBQW9CLEtBQUssS0FBSyxDQUFDO0lBQ3JDLE1BQU0sbUJBQW1CLGtCQUFrQixJQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sYUFBWSxFQUFFLEdBQ3JFLGlCQUFpQjtJQUduQixJQUFJLENBQUMsa0JBQWtCO1FBQ3JCLE1BQU0sU0FBUyxNQUFNO1FBQ3JCLE1BQU0sY0FBYyxNQUFNLE9BQU8sU0FBUyxDQUFDLE1BQU0sQ0FBQyxhQUFhO1lBQzdEO1FBQ0Y7UUFDQSxJQUFHLENBQUMsYUFBYTtZQUNmLE1BQU0sSUFBSSxNQUFNLHFDQUFvQztRQUN0RCxDQUFDO1FBQ0QsUUFBUSxHQUFHLENBQUM7UUFDWixNQUFNLEtBQUssYUFBYSxDQUN0QixlQUNBLEtBQUssU0FBUyxDQUFDO2VBQUk7WUFBbUI7Z0JBQ3BDLElBQUksWUFBWSxFQUFFO2dCQUNsQjtZQUNGO1NBQUU7UUFFSixPQUFPLFlBQVksRUFBRTtJQUN2QixDQUFDO0lBRUQsT0FBTyxpQkFBaUIsRUFBRTtBQUM1QjtBQUVBLGVBQWUsY0FBYyJ9