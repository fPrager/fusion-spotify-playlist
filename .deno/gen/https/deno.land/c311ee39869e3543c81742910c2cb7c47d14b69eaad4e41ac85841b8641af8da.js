// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.
import { notImplemented } from "./_utils.ts";
import { urlToHttpOptions } from "./internal/url.ts";
import { Agent as HttpAgent, ClientRequest } from "./http.ts";
export class Agent extends HttpAgent {
}
export class Server {
    constructor(){
        notImplemented("https.Server.prototype.constructor");
    }
}
export function createServer() {
    notImplemented("https.createServer");
}
// Store additional root CAs.
// undefined means NODE_EXTRA_CA_CERTS is not checked yet.
// null means there's no additional root CAs.
let caCerts;
// deno-lint-ignore no-explicit-any
export function get(...args) {
    const req = request(args[0], args[1], args[2]);
    req.end();
    return req;
}
export const globalAgent = undefined;
/** HttpsClientRequest class loosely follows http.ClientRequest class API. */ class HttpsClientRequest extends ClientRequest {
    defaultProtocol = "https:";
    async _createCustomClient() {
        if (caCerts === null) {
            return undefined;
        }
        if (caCerts !== undefined) {
            return Deno.createHttpClient({
                caCerts
            });
        }
        const status = await Deno.permissions.query({
            name: "env",
            variable: "NODE_EXTRA_CA_CERTS"
        });
        if (status.state !== "granted") {
            caCerts = null;
            return undefined;
        }
        const certFilename = Deno.env.get("NODE_EXTRA_CA_CERTS");
        if (!certFilename) {
            caCerts = null;
            return undefined;
        }
        const caCert = await Deno.readTextFile(certFilename);
        caCerts = [
            caCert
        ];
        return Deno.createHttpClient({
            caCerts
        });
    }
    _createSocket() {
        // deno-lint-ignore no-explicit-any
        return {
            authorized: true
        };
    }
}
// deno-lint-ignore no-explicit-any
export function request(...args) {
    let options = {};
    if (typeof args[0] === "string") {
        options = urlToHttpOptions(new URL(args.shift()));
    } else if (args[0] instanceof URL) {
        options = urlToHttpOptions(args.shift());
    }
    if (args[0] && typeof args[0] !== "function") {
        Object.assign(options, args.shift());
    }
    args.unshift(options);
    return new HttpsClientRequest(args[0], args[1]);
}
export default {
    Agent,
    Server,
    createServer,
    get,
    globalAgent,
    request
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaHR0cHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQgYW5kIE5vZGUgY29udHJpYnV0b3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IHVybFRvSHR0cE9wdGlvbnMgfSBmcm9tIFwiLi9pbnRlcm5hbC91cmwudHNcIjtcbmltcG9ydCB7XG4gIEFnZW50IGFzIEh0dHBBZ2VudCxcbiAgQ2xpZW50UmVxdWVzdCxcbiAgSW5jb21pbmdNZXNzYWdlRm9yQ2xpZW50IGFzIEluY29taW5nTWVzc2FnZSxcbiAgdHlwZSBSZXF1ZXN0T3B0aW9ucyxcbn0gZnJvbSBcIi4vaHR0cC50c1wiO1xuaW1wb3J0IHR5cGUgeyBTb2NrZXQgfSBmcm9tIFwiLi9uZXQudHNcIjtcblxuZXhwb3J0IGNsYXNzIEFnZW50IGV4dGVuZHMgSHR0cEFnZW50IHtcbn1cblxuZXhwb3J0IGNsYXNzIFNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiaHR0cHMuU2VydmVyLnByb3RvdHlwZS5jb25zdHJ1Y3RvclwiKTtcbiAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcigpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJodHRwcy5jcmVhdGVTZXJ2ZXJcIik7XG59XG5cbmludGVyZmFjZSBIdHRwc1JlcXVlc3RPcHRpb25zIGV4dGVuZHMgUmVxdWVzdE9wdGlvbnMge1xuICBfOiB1bmtub3duO1xufVxuXG4vLyBTdG9yZSBhZGRpdGlvbmFsIHJvb3QgQ0FzLlxuLy8gdW5kZWZpbmVkIG1lYW5zIE5PREVfRVhUUkFfQ0FfQ0VSVFMgaXMgbm90IGNoZWNrZWQgeWV0LlxuLy8gbnVsbCBtZWFucyB0aGVyZSdzIG5vIGFkZGl0aW9uYWwgcm9vdCBDQXMuXG5sZXQgY2FDZXJ0czogc3RyaW5nW10gfCB1bmRlZmluZWQgfCBudWxsO1xuXG4vKiogTWFrZXMgYSByZXF1ZXN0IHRvIGFuIGh0dHBzIHNlcnZlci4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXQoXG4gIHVybDogc3RyaW5nIHwgVVJMLFxuICBjYj86IChyZXM6IEluY29taW5nTWVzc2FnZSkgPT4gdm9pZCxcbik6IEh0dHBzQ2xpZW50UmVxdWVzdDtcbmV4cG9ydCBmdW5jdGlvbiBnZXQoXG4gIG9wdHM6IEh0dHBzUmVxdWVzdE9wdGlvbnMsXG4gIGNiPzogKHJlczogSW5jb21pbmdNZXNzYWdlKSA9PiB2b2lkLFxuKTogSHR0cHNDbGllbnRSZXF1ZXN0O1xuZXhwb3J0IGZ1bmN0aW9uIGdldChcbiAgdXJsOiBzdHJpbmcgfCBVUkwsXG4gIG9wdHM6IEh0dHBzUmVxdWVzdE9wdGlvbnMsXG4gIGNiPzogKHJlczogSW5jb21pbmdNZXNzYWdlKSA9PiB2b2lkLFxuKTogSHR0cHNDbGllbnRSZXF1ZXN0O1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmV4cG9ydCBmdW5jdGlvbiBnZXQoLi4uYXJnczogYW55W10pIHtcbiAgY29uc3QgcmVxID0gcmVxdWVzdChhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcbiAgcmVxLmVuZCgpO1xuICByZXR1cm4gcmVxO1xufVxuXG5leHBvcnQgY29uc3QgZ2xvYmFsQWdlbnQgPSB1bmRlZmluZWQ7XG4vKiogSHR0cHNDbGllbnRSZXF1ZXN0IGNsYXNzIGxvb3NlbHkgZm9sbG93cyBodHRwLkNsaWVudFJlcXVlc3QgY2xhc3MgQVBJLiAqL1xuY2xhc3MgSHR0cHNDbGllbnRSZXF1ZXN0IGV4dGVuZHMgQ2xpZW50UmVxdWVzdCB7XG4gIG92ZXJyaWRlIGRlZmF1bHRQcm90b2NvbCA9IFwiaHR0cHM6XCI7XG4gIG92ZXJyaWRlIGFzeW5jIF9jcmVhdGVDdXN0b21DbGllbnQoKTogUHJvbWlzZTxcbiAgICBEZW5vLkh0dHBDbGllbnQgfCB1bmRlZmluZWRcbiAgPiB7XG4gICAgaWYgKGNhQ2VydHMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGlmIChjYUNlcnRzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBEZW5vLmNyZWF0ZUh0dHBDbGllbnQoeyBjYUNlcnRzIH0pO1xuICAgIH1cbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBEZW5vLnBlcm1pc3Npb25zLnF1ZXJ5KHtcbiAgICAgIG5hbWU6IFwiZW52XCIsXG4gICAgICB2YXJpYWJsZTogXCJOT0RFX0VYVFJBX0NBX0NFUlRTXCIsXG4gICAgfSk7XG4gICAgaWYgKHN0YXR1cy5zdGF0ZSAhPT0gXCJncmFudGVkXCIpIHtcbiAgICAgIGNhQ2VydHMgPSBudWxsO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgY29uc3QgY2VydEZpbGVuYW1lID0gRGVuby5lbnYuZ2V0KFwiTk9ERV9FWFRSQV9DQV9DRVJUU1wiKTtcbiAgICBpZiAoIWNlcnRGaWxlbmFtZSkge1xuICAgICAgY2FDZXJ0cyA9IG51bGw7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBjYUNlcnQgPSBhd2FpdCBEZW5vLnJlYWRUZXh0RmlsZShjZXJ0RmlsZW5hbWUpO1xuICAgIGNhQ2VydHMgPSBbY2FDZXJ0XTtcbiAgICByZXR1cm4gRGVuby5jcmVhdGVIdHRwQ2xpZW50KHsgY2FDZXJ0cyB9KTtcbiAgfVxuXG4gIG92ZXJyaWRlIF9jcmVhdGVTb2NrZXQoKTogU29ja2V0IHtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHJldHVybiB7IGF1dGhvcml6ZWQ6IHRydWUgfSBhcyBhbnk7XG4gIH1cbn1cblxuLyoqIE1ha2VzIGEgcmVxdWVzdCB0byBhbiBodHRwcyBzZXJ2ZXIuICovXG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdChcbiAgdXJsOiBzdHJpbmcgfCBVUkwsXG4gIGNiPzogKHJlczogSW5jb21pbmdNZXNzYWdlKSA9PiB2b2lkLFxuKTogSHR0cHNDbGllbnRSZXF1ZXN0O1xuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3QoXG4gIG9wdHM6IEh0dHBzUmVxdWVzdE9wdGlvbnMsXG4gIGNiPzogKHJlczogSW5jb21pbmdNZXNzYWdlKSA9PiB2b2lkLFxuKTogSHR0cHNDbGllbnRSZXF1ZXN0O1xuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3QoXG4gIHVybDogc3RyaW5nIHwgVVJMLFxuICBvcHRzOiBIdHRwc1JlcXVlc3RPcHRpb25zLFxuICBjYj86IChyZXM6IEluY29taW5nTWVzc2FnZSkgPT4gdm9pZCxcbik6IEh0dHBzQ2xpZW50UmVxdWVzdDtcbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gcmVxdWVzdCguLi5hcmdzOiBhbnlbXSkge1xuICBsZXQgb3B0aW9ucyA9IHt9O1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBvcHRpb25zID0gdXJsVG9IdHRwT3B0aW9ucyhuZXcgVVJMKGFyZ3Muc2hpZnQoKSkpO1xuICB9IGVsc2UgaWYgKGFyZ3NbMF0gaW5zdGFuY2VvZiBVUkwpIHtcbiAgICBvcHRpb25zID0gdXJsVG9IdHRwT3B0aW9ucyhhcmdzLnNoaWZ0KCkpO1xuICB9XG4gIGlmIChhcmdzWzBdICYmIHR5cGVvZiBhcmdzWzBdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBPYmplY3QuYXNzaWduKG9wdGlvbnMsIGFyZ3Muc2hpZnQoKSk7XG4gIH1cbiAgYXJncy51bnNoaWZ0KG9wdGlvbnMpO1xuICByZXR1cm4gbmV3IEh0dHBzQ2xpZW50UmVxdWVzdChhcmdzWzBdLCBhcmdzWzFdKTtcbn1cbmV4cG9ydCBkZWZhdWx0IHtcbiAgQWdlbnQsXG4gIFNlcnZlcixcbiAgY3JlYXRlU2VydmVyLFxuICBnZXQsXG4gIGdsb2JhbEFnZW50LFxuICByZXF1ZXN0LFxufTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsNEVBQTRFO0FBRTVFLFNBQVMsY0FBYyxRQUFRLGNBQWM7QUFDN0MsU0FBUyxnQkFBZ0IsUUFBUSxvQkFBb0I7QUFDckQsU0FDRSxTQUFTLFNBQVMsRUFDbEIsYUFBYSxRQUdSLFlBQVk7QUFHbkIsT0FBTyxNQUFNLGNBQWM7QUFDM0IsQ0FBQztBQUVELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sU0FBUyxlQUFlO0lBQzdCLGVBQWU7QUFDakIsQ0FBQztBQU1ELDZCQUE2QjtBQUM3QiwwREFBMEQ7QUFDMUQsNkNBQTZDO0FBQzdDLElBQUk7QUFnQkosbUNBQW1DO0FBQ25DLE9BQU8sU0FBUyxJQUFJLEdBQUcsSUFBVyxFQUFFO0lBQ2xDLE1BQU0sTUFBTSxRQUFRLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtJQUM3QyxJQUFJLEdBQUc7SUFDUCxPQUFPO0FBQ1QsQ0FBQztBQUVELE9BQU8sTUFBTSxjQUFjLFVBQVU7QUFDckMsMkVBQTJFLEdBQzNFLE1BQU0sMkJBQTJCO0lBQ3RCLGtCQUFrQixTQUFTO0lBQ3BDLE1BQWUsc0JBRWI7UUFDQSxJQUFJLFlBQVksSUFBSSxFQUFFO1lBQ3BCLE9BQU87UUFDVCxDQUFDO1FBQ0QsSUFBSSxZQUFZLFdBQVc7WUFDekIsT0FBTyxLQUFLLGdCQUFnQixDQUFDO2dCQUFFO1lBQVE7UUFDekMsQ0FBQztRQUNELE1BQU0sU0FBUyxNQUFNLEtBQUssV0FBVyxDQUFDLEtBQUssQ0FBQztZQUMxQyxNQUFNO1lBQ04sVUFBVTtRQUNaO1FBQ0EsSUFBSSxPQUFPLEtBQUssS0FBSyxXQUFXO1lBQzlCLFVBQVUsSUFBSTtZQUNkLE9BQU87UUFDVCxDQUFDO1FBQ0QsTUFBTSxlQUFlLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQztRQUNsQyxJQUFJLENBQUMsY0FBYztZQUNqQixVQUFVLElBQUk7WUFDZCxPQUFPO1FBQ1QsQ0FBQztRQUNELE1BQU0sU0FBUyxNQUFNLEtBQUssWUFBWSxDQUFDO1FBQ3ZDLFVBQVU7WUFBQztTQUFPO1FBQ2xCLE9BQU8sS0FBSyxnQkFBZ0IsQ0FBQztZQUFFO1FBQVE7SUFDekM7SUFFUyxnQkFBd0I7UUFDL0IsbUNBQW1DO1FBQ25DLE9BQU87WUFBRSxZQUFZLElBQUk7UUFBQztJQUM1QjtBQUNGO0FBZ0JBLG1DQUFtQztBQUNuQyxPQUFPLFNBQVMsUUFBUSxHQUFHLElBQVcsRUFBRTtJQUN0QyxJQUFJLFVBQVUsQ0FBQztJQUNmLElBQUksT0FBTyxJQUFJLENBQUMsRUFBRSxLQUFLLFVBQVU7UUFDL0IsVUFBVSxpQkFBaUIsSUFBSSxJQUFJLEtBQUssS0FBSztJQUMvQyxPQUFPLElBQUksSUFBSSxDQUFDLEVBQUUsWUFBWSxLQUFLO1FBQ2pDLFVBQVUsaUJBQWlCLEtBQUssS0FBSztJQUN2QyxDQUFDO0lBQ0QsSUFBSSxJQUFJLENBQUMsRUFBRSxJQUFJLE9BQU8sSUFBSSxDQUFDLEVBQUUsS0FBSyxZQUFZO1FBQzVDLE9BQU8sTUFBTSxDQUFDLFNBQVMsS0FBSyxLQUFLO0lBQ25DLENBQUM7SUFDRCxLQUFLLE9BQU8sQ0FBQztJQUNiLE9BQU8sSUFBSSxtQkFBbUIsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNoRCxDQUFDO0FBQ0QsZUFBZTtJQUNiO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtBQUNGLEVBQUUifQ==