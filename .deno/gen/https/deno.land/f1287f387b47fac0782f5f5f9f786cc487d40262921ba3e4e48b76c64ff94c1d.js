// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { notImplemented } from "./_utils.ts";
import { zlib as constants } from "./internal_binding/constants.ts";
import { codes, createDeflate, createDeflateRaw, createGunzip, createGzip, createInflate, createInflateRaw, createUnzip, Deflate, deflate, DeflateRaw, deflateRaw, deflateRawSync, deflateSync, Gunzip, gunzip, gunzipSync, Gzip, gzip, gzipSync, Inflate, inflate, InflateRaw, inflateRaw, inflateRawSync, inflateSync, Unzip, unzip, unzipSync } from "./_zlib.mjs";
export class Options {
    constructor(){
        notImplemented("Options.prototype.constructor");
    }
}
export class BrotliOptions {
    constructor(){
        notImplemented("BrotliOptions.prototype.constructor");
    }
}
export class BrotliCompress {
    constructor(){
        notImplemented("BrotliCompress.prototype.constructor");
    }
}
export class BrotliDecompress {
    constructor(){
        notImplemented("BrotliDecompress.prototype.constructor");
    }
}
export class ZlibBase {
    constructor(){
        notImplemented("ZlibBase.prototype.constructor");
    }
}
export { constants };
export function createBrotliCompress() {
    notImplemented("createBrotliCompress");
}
export function createBrotliDecompress() {
    notImplemented("createBrotliDecompress");
}
export function brotliCompress() {
    notImplemented("brotliCompress");
}
export function brotliCompressSync() {
    notImplemented("brotliCompressSync");
}
export function brotliDecompress() {
    notImplemented("brotliDecompress");
}
export function brotliDecompressSync() {
    notImplemented("brotliDecompressSync");
}
export default {
    Options,
    BrotliOptions,
    BrotliCompress,
    BrotliDecompress,
    Deflate,
    DeflateRaw,
    Gunzip,
    Gzip,
    Inflate,
    InflateRaw,
    Unzip,
    ZlibBase,
    constants,
    codes,
    createBrotliCompress,
    createBrotliDecompress,
    createDeflate,
    createDeflateRaw,
    createGunzip,
    createGzip,
    createInflate,
    createInflateRaw,
    createUnzip,
    brotliCompress,
    brotliCompressSync,
    brotliDecompress,
    brotliDecompressSync,
    deflate,
    deflateSync,
    deflateRaw,
    deflateRawSync,
    gunzip,
    gunzipSync,
    gzip,
    gzipSync,
    inflate,
    inflateSync,
    inflateRaw,
    inflateRawSync,
    unzip,
    unzipSync
};
export { codes, createDeflate, createDeflateRaw, createGunzip, createGzip, createInflate, createInflateRaw, createUnzip, Deflate, deflate, DeflateRaw, deflateRaw, deflateRawSync, deflateSync, Gunzip, gunzip, gunzipSync, Gzip, gzip, gzipSync, Inflate, inflate, InflateRaw, inflateRaw, inflateRawSync, inflateSync, Unzip, unzip, unzipSync };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvemxpYi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IHpsaWIgYXMgY29uc3RhbnRzIH0gZnJvbSBcIi4vaW50ZXJuYWxfYmluZGluZy9jb25zdGFudHMudHNcIjtcbmltcG9ydCB7XG4gIGNvZGVzLFxuICBjcmVhdGVEZWZsYXRlLFxuICBjcmVhdGVEZWZsYXRlUmF3LFxuICBjcmVhdGVHdW56aXAsXG4gIGNyZWF0ZUd6aXAsXG4gIGNyZWF0ZUluZmxhdGUsXG4gIGNyZWF0ZUluZmxhdGVSYXcsXG4gIGNyZWF0ZVVuemlwLFxuICBEZWZsYXRlLFxuICBkZWZsYXRlLFxuICBEZWZsYXRlUmF3LFxuICBkZWZsYXRlUmF3LFxuICBkZWZsYXRlUmF3U3luYyxcbiAgZGVmbGF0ZVN5bmMsXG4gIEd1bnppcCxcbiAgZ3VuemlwLFxuICBndW56aXBTeW5jLFxuICBHemlwLFxuICBnemlwLFxuICBnemlwU3luYyxcbiAgSW5mbGF0ZSxcbiAgaW5mbGF0ZSxcbiAgSW5mbGF0ZVJhdyxcbiAgaW5mbGF0ZVJhdyxcbiAgaW5mbGF0ZVJhd1N5bmMsXG4gIGluZmxhdGVTeW5jLFxuICBVbnppcCxcbiAgdW56aXAsXG4gIHVuemlwU3luYyxcbn0gZnJvbSBcIi4vX3psaWIubWpzXCI7XG5leHBvcnQgY2xhc3MgT3B0aW9ucyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIG5vdEltcGxlbWVudGVkKFwiT3B0aW9ucy5wcm90b3R5cGUuY29uc3RydWN0b3JcIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBCcm90bGlPcHRpb25zIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJCcm90bGlPcHRpb25zLnByb3RvdHlwZS5jb25zdHJ1Y3RvclwiKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEJyb3RsaUNvbXByZXNzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJCcm90bGlDb21wcmVzcy5wcm90b3R5cGUuY29uc3RydWN0b3JcIik7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBCcm90bGlEZWNvbXByZXNzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJCcm90bGlEZWNvbXByZXNzLnByb3RvdHlwZS5jb25zdHJ1Y3RvclwiKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIFpsaWJCYXNlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJabGliQmFzZS5wcm90b3R5cGUuY29uc3RydWN0b3JcIik7XG4gIH1cbn1cbmV4cG9ydCB7IGNvbnN0YW50cyB9O1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3RsaUNvbXByZXNzKCkge1xuICBub3RJbXBsZW1lbnRlZChcImNyZWF0ZUJyb3RsaUNvbXByZXNzXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUJyb3RsaURlY29tcHJlc3MoKSB7XG4gIG5vdEltcGxlbWVudGVkKFwiY3JlYXRlQnJvdGxpRGVjb21wcmVzc1wiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBicm90bGlDb21wcmVzcygpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJicm90bGlDb21wcmVzc1wiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBicm90bGlDb21wcmVzc1N5bmMoKSB7XG4gIG5vdEltcGxlbWVudGVkKFwiYnJvdGxpQ29tcHJlc3NTeW5jXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGJyb3RsaURlY29tcHJlc3MoKSB7XG4gIG5vdEltcGxlbWVudGVkKFwiYnJvdGxpRGVjb21wcmVzc1wiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBicm90bGlEZWNvbXByZXNzU3luYygpIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJicm90bGlEZWNvbXByZXNzU3luY1wiKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQge1xuICBPcHRpb25zLFxuICBCcm90bGlPcHRpb25zLFxuICBCcm90bGlDb21wcmVzcyxcbiAgQnJvdGxpRGVjb21wcmVzcyxcbiAgRGVmbGF0ZSxcbiAgRGVmbGF0ZVJhdyxcbiAgR3VuemlwLFxuICBHemlwLFxuICBJbmZsYXRlLFxuICBJbmZsYXRlUmF3LFxuICBVbnppcCxcbiAgWmxpYkJhc2UsXG4gIGNvbnN0YW50cyxcbiAgY29kZXMsXG4gIGNyZWF0ZUJyb3RsaUNvbXByZXNzLFxuICBjcmVhdGVCcm90bGlEZWNvbXByZXNzLFxuICBjcmVhdGVEZWZsYXRlLFxuICBjcmVhdGVEZWZsYXRlUmF3LFxuICBjcmVhdGVHdW56aXAsXG4gIGNyZWF0ZUd6aXAsXG4gIGNyZWF0ZUluZmxhdGUsXG4gIGNyZWF0ZUluZmxhdGVSYXcsXG4gIGNyZWF0ZVVuemlwLFxuICBicm90bGlDb21wcmVzcyxcbiAgYnJvdGxpQ29tcHJlc3NTeW5jLFxuICBicm90bGlEZWNvbXByZXNzLFxuICBicm90bGlEZWNvbXByZXNzU3luYyxcbiAgZGVmbGF0ZSxcbiAgZGVmbGF0ZVN5bmMsXG4gIGRlZmxhdGVSYXcsXG4gIGRlZmxhdGVSYXdTeW5jLFxuICBndW56aXAsXG4gIGd1bnppcFN5bmMsXG4gIGd6aXAsXG4gIGd6aXBTeW5jLFxuICBpbmZsYXRlLFxuICBpbmZsYXRlU3luYyxcbiAgaW5mbGF0ZVJhdyxcbiAgaW5mbGF0ZVJhd1N5bmMsXG4gIHVuemlwLFxuICB1bnppcFN5bmMsXG59O1xuXG5leHBvcnQge1xuICBjb2RlcyxcbiAgY3JlYXRlRGVmbGF0ZSxcbiAgY3JlYXRlRGVmbGF0ZVJhdyxcbiAgY3JlYXRlR3VuemlwLFxuICBjcmVhdGVHemlwLFxuICBjcmVhdGVJbmZsYXRlLFxuICBjcmVhdGVJbmZsYXRlUmF3LFxuICBjcmVhdGVVbnppcCxcbiAgRGVmbGF0ZSxcbiAgZGVmbGF0ZSxcbiAgRGVmbGF0ZVJhdyxcbiAgZGVmbGF0ZVJhdyxcbiAgZGVmbGF0ZVJhd1N5bmMsXG4gIGRlZmxhdGVTeW5jLFxuICBHdW56aXAsXG4gIGd1bnppcCxcbiAgZ3VuemlwU3luYyxcbiAgR3ppcCxcbiAgZ3ppcCxcbiAgZ3ppcFN5bmMsXG4gIEluZmxhdGUsXG4gIGluZmxhdGUsXG4gIEluZmxhdGVSYXcsXG4gIGluZmxhdGVSYXcsXG4gIGluZmxhdGVSYXdTeW5jLFxuICBpbmZsYXRlU3luYyxcbiAgVW56aXAsXG4gIHVuemlwLFxuICB1bnppcFN5bmMsXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxTQUFTLGNBQWMsUUFBUSxjQUFjO0FBQzdDLFNBQVMsUUFBUSxTQUFTLFFBQVEsa0NBQWtDO0FBQ3BFLFNBQ0UsS0FBSyxFQUNMLGFBQWEsRUFDYixnQkFBZ0IsRUFDaEIsWUFBWSxFQUNaLFVBQVUsRUFDVixhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLFdBQVcsRUFDWCxPQUFPLEVBQ1AsT0FBTyxFQUNQLFVBQVUsRUFDVixVQUFVLEVBQ1YsY0FBYyxFQUNkLFdBQVcsRUFDWCxNQUFNLEVBQ04sTUFBTSxFQUNOLFVBQVUsRUFDVixJQUFJLEVBQ0osSUFBSSxFQUNKLFFBQVEsRUFDUixPQUFPLEVBQ1AsT0FBTyxFQUNQLFVBQVUsRUFDVixVQUFVLEVBQ1YsY0FBYyxFQUNkLFdBQVcsRUFDWCxLQUFLLEVBQ0wsS0FBSyxFQUNMLFNBQVMsUUFDSixjQUFjO0FBQ3JCLE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELE9BQU8sTUFBTTtJQUNYLGFBQWM7UUFDWixlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUNELFNBQVMsU0FBUyxHQUFHO0FBQ3JCLE9BQU8sU0FBUyx1QkFBdUI7SUFDckMsZUFBZTtBQUNqQixDQUFDO0FBQ0QsT0FBTyxTQUFTLHlCQUF5QjtJQUN2QyxlQUFlO0FBQ2pCLENBQUM7QUFDRCxPQUFPLFNBQVMsaUJBQWlCO0lBQy9CLGVBQWU7QUFDakIsQ0FBQztBQUNELE9BQU8sU0FBUyxxQkFBcUI7SUFDbkMsZUFBZTtBQUNqQixDQUFDO0FBQ0QsT0FBTyxTQUFTLG1CQUFtQjtJQUNqQyxlQUFlO0FBQ2pCLENBQUM7QUFDRCxPQUFPLFNBQVMsdUJBQXVCO0lBQ3JDLGVBQWU7QUFDakIsQ0FBQztBQUVELGVBQWU7SUFDYjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0FBQ0YsRUFBRTtBQUVGLFNBQ0UsS0FBSyxFQUNMLGFBQWEsRUFDYixnQkFBZ0IsRUFDaEIsWUFBWSxFQUNaLFVBQVUsRUFDVixhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLFdBQVcsRUFDWCxPQUFPLEVBQ1AsT0FBTyxFQUNQLFVBQVUsRUFDVixVQUFVLEVBQ1YsY0FBYyxFQUNkLFdBQVcsRUFDWCxNQUFNLEVBQ04sTUFBTSxFQUNOLFVBQVUsRUFDVixJQUFJLEVBQ0osSUFBSSxFQUNKLFFBQVEsRUFDUixPQUFPLEVBQ1AsT0FBTyxFQUNQLFVBQVUsRUFDVixVQUFVLEVBQ1YsY0FBYyxFQUNkLFdBQVcsRUFDWCxLQUFLLEVBQ0wsS0FBSyxFQUNMLFNBQVMsR0FDVCJ9