// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { fromFileUrl } from "../path.ts";
import { promisify } from "../internal/util.mjs";
export function truncate(path, lenOrCallback, maybeCallback) {
    path = path instanceof URL ? fromFileUrl(path) : path;
    const len = typeof lenOrCallback === "number" ? lenOrCallback : undefined;
    const callback = typeof lenOrCallback === "function" ? lenOrCallback : maybeCallback;
    if (!callback) throw new Error("No callback function supplied");
    Deno.truncate(path, len).then(()=>callback(null), callback);
}
export const truncatePromise = promisify(truncate);
export function truncateSync(path, len) {
    path = path instanceof URL ? fromFileUrl(path) : path;
    Deno.truncateSync(path, len);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc190cnVuY2F0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgQ2FsbGJhY2tXaXRoRXJyb3IgfSBmcm9tIFwiLi9fZnNfY29tbW9uLnRzXCI7XG5pbXBvcnQgeyBmcm9tRmlsZVVybCB9IGZyb20gXCIuLi9wYXRoLnRzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHRydW5jYXRlKFxuICBwYXRoOiBzdHJpbmcgfCBVUkwsXG4gIGxlbk9yQ2FsbGJhY2s6IG51bWJlciB8IENhbGxiYWNrV2l0aEVycm9yLFxuICBtYXliZUNhbGxiYWNrPzogQ2FsbGJhY2tXaXRoRXJyb3IsXG4pIHtcbiAgcGF0aCA9IHBhdGggaW5zdGFuY2VvZiBVUkwgPyBmcm9tRmlsZVVybChwYXRoKSA6IHBhdGg7XG4gIGNvbnN0IGxlbjogbnVtYmVyIHwgdW5kZWZpbmVkID0gdHlwZW9mIGxlbk9yQ2FsbGJhY2sgPT09IFwibnVtYmVyXCJcbiAgICA/IGxlbk9yQ2FsbGJhY2tcbiAgICA6IHVuZGVmaW5lZDtcbiAgY29uc3QgY2FsbGJhY2s6IENhbGxiYWNrV2l0aEVycm9yID0gdHlwZW9mIGxlbk9yQ2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIlxuICAgID8gbGVuT3JDYWxsYmFja1xuICAgIDogbWF5YmVDYWxsYmFjayBhcyBDYWxsYmFja1dpdGhFcnJvcjtcblxuICBpZiAoIWNhbGxiYWNrKSB0aHJvdyBuZXcgRXJyb3IoXCJObyBjYWxsYmFjayBmdW5jdGlvbiBzdXBwbGllZFwiKTtcblxuICBEZW5vLnRydW5jYXRlKHBhdGgsIGxlbikudGhlbigoKSA9PiBjYWxsYmFjayhudWxsKSwgY2FsbGJhY2spO1xufVxuXG5leHBvcnQgY29uc3QgdHJ1bmNhdGVQcm9taXNlID0gcHJvbWlzaWZ5KHRydW5jYXRlKSBhcyAoXG4gIHBhdGg6IHN0cmluZyB8IFVSTCxcbiAgbGVuPzogbnVtYmVyLFxuKSA9PiBQcm9taXNlPHZvaWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gdHJ1bmNhdGVTeW5jKHBhdGg6IHN0cmluZyB8IFVSTCwgbGVuPzogbnVtYmVyKSB7XG4gIHBhdGggPSBwYXRoIGluc3RhbmNlb2YgVVJMID8gZnJvbUZpbGVVcmwocGF0aCkgOiBwYXRoO1xuXG4gIERlbm8udHJ1bmNhdGVTeW5jKHBhdGgsIGxlbik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBRTFFLFNBQVMsV0FBVyxRQUFRLGFBQWE7QUFDekMsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBRWpELE9BQU8sU0FBUyxTQUNkLElBQWtCLEVBQ2xCLGFBQXlDLEVBQ3pDLGFBQWlDLEVBQ2pDO0lBQ0EsT0FBTyxnQkFBZ0IsTUFBTSxZQUFZLFFBQVEsSUFBSTtJQUNyRCxNQUFNLE1BQTBCLE9BQU8sa0JBQWtCLFdBQ3JELGdCQUNBLFNBQVM7SUFDYixNQUFNLFdBQThCLE9BQU8sa0JBQWtCLGFBQ3pELGdCQUNBLGFBQWtDO0lBRXRDLElBQUksQ0FBQyxVQUFVLE1BQU0sSUFBSSxNQUFNLGlDQUFpQztJQUVoRSxLQUFLLFFBQVEsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLElBQU0sU0FBUyxJQUFJLEdBQUc7QUFDdEQsQ0FBQztBQUVELE9BQU8sTUFBTSxrQkFBa0IsVUFBVSxVQUd0QjtBQUVuQixPQUFPLFNBQVMsYUFBYSxJQUFrQixFQUFFLEdBQVksRUFBRTtJQUM3RCxPQUFPLGdCQUFnQixNQUFNLFlBQVksUUFBUSxJQUFJO0lBRXJELEtBQUssWUFBWSxDQUFDLE1BQU07QUFDMUIsQ0FBQyJ9