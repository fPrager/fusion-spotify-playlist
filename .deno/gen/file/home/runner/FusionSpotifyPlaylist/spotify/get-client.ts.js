import { Client } from "npm:spotify-api.js@9.2.5";
let client = null;
const getClient = async ()=>{
    if (!client) {
        const token = Deno.env.get("TOKEN");
        if (!token) {
            throw new Error("Missing token in env. To get a token, visit the Spotify Developer portal, test the api by create a playlist and use that bearer token here (without Bearer prefix).");
        }
        client = await Client.create({
            token
        });
    }
    return client;
};
/**
curl --request GET \
  --url https://api.spotify.com/v1/users/sitterhonk/playlists \
  --header 'Authorization: Bearer BQBSJw...qbFGp6'
*/ export default getClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvRnVzaW9uU3BvdGlmeVBsYXlsaXN0L3Nwb3RpZnkvZ2V0LWNsaWVudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwibnBtOnNwb3RpZnktYXBpLmpzQDkuMi41XCI7XG5cbmxldCBjbGllbnQ6IENsaWVudCB8IG51bGwgPSBudWxsO1xuXG5jb25zdCBnZXRDbGllbnQgPSBhc3luYyAoKSA9PiB7XG4gIGlmICghY2xpZW50KSB7XG4gICAgY29uc3QgdG9rZW4gPSBEZW5vLmVudi5nZXQoXCJUT0tFTlwiKTtcbiAgICBpZiAoIXRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIHRva2VuIGluIGVudi4gVG8gZ2V0IGEgdG9rZW4sIHZpc2l0IHRoZSBTcG90aWZ5IERldmVsb3BlciBwb3J0YWwsIHRlc3QgdGhlIGFwaSBieSBjcmVhdGUgYSBwbGF5bGlzdCBhbmQgdXNlIHRoYXQgYmVhcmVyIHRva2VuIGhlcmUgKHdpdGhvdXQgQmVhcmVyIHByZWZpeCkuXCIpO1xuICAgIH1cblxuICAgIGNsaWVudCA9IGF3YWl0IENsaWVudC5jcmVhdGUoe1xuICAgICAgdG9rZW4sXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gY2xpZW50O1xufTtcblxuLyoqXG5jdXJsIC0tcmVxdWVzdCBHRVQgXFxcbiAgLS11cmwgaHR0cHM6Ly9hcGkuc3BvdGlmeS5jb20vdjEvdXNlcnMvc2l0dGVyaG9uay9wbGF5bGlzdHMgXFxcbiAgLS1oZWFkZXIgJ0F1dGhvcml6YXRpb246IEJlYXJlciBCUUJTSncuLi5xYkZHcDYnXG4qL1xuXG5leHBvcnQgZGVmYXVsdCBnZXRDbGllbnQ7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxNQUFNLFFBQVEsMkJBQTJCO0FBRWxELElBQUksU0FBd0IsSUFBSTtBQUVoQyxNQUFNLFlBQVksVUFBWTtJQUM1QixJQUFJLENBQUMsUUFBUTtRQUNYLE1BQU0sUUFBUSxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUM7UUFDM0IsSUFBSSxDQUFDLE9BQU87WUFDVixNQUFNLElBQUksTUFBTSx1S0FBdUs7UUFDekwsQ0FBQztRQUVELFNBQVMsTUFBTSxPQUFPLE1BQU0sQ0FBQztZQUMzQjtRQUNGO0lBQ0YsQ0FBQztJQUVELE9BQU87QUFDVDtBQUVBOzs7O0FBSUEsR0FFQSxlQUFlLFVBQVUifQ==