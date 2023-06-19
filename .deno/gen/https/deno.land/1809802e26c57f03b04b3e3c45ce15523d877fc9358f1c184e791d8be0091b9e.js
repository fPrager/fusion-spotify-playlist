// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import Dirent from "./_fs_dirent.ts";
import { assert } from "../../_util/asserts.ts";
import { ERR_MISSING_ARGS } from "../internal/errors.ts";
export default class Dir {
    #dirPath;
    #syncIterator;
    #asyncIterator;
    constructor(path){
        if (!path) {
            throw new ERR_MISSING_ARGS("path");
        }
        this.#dirPath = path;
    }
    get path() {
        if (this.#dirPath instanceof Uint8Array) {
            return new TextDecoder().decode(this.#dirPath);
        }
        return this.#dirPath;
    }
    // deno-lint-ignore no-explicit-any
    read(callback) {
        return new Promise((resolve, reject)=>{
            if (!this.#asyncIterator) {
                this.#asyncIterator = Deno.readDir(this.path)[Symbol.asyncIterator]();
            }
            assert(this.#asyncIterator);
            this.#asyncIterator.next().then((iteratorResult)=>{
                resolve(iteratorResult.done ? null : new Dirent(iteratorResult.value));
                if (callback) {
                    callback(null, iteratorResult.done ? null : new Dirent(iteratorResult.value));
                }
            }, (err)=>{
                if (callback) {
                    callback(err);
                }
                reject(err);
            });
        });
    }
    readSync() {
        if (!this.#syncIterator) {
            this.#syncIterator = Deno.readDirSync(this.path)[Symbol.iterator]();
        }
        const iteratorResult = this.#syncIterator.next();
        if (iteratorResult.done) {
            return null;
        } else {
            return new Dirent(iteratorResult.value);
        }
    }
    /**
   * Unlike Node, Deno does not require managing resource ids for reading
   * directories, and therefore does not need to close directories when
   * finished reading.
   */ // deno-lint-ignore no-explicit-any
    close(callback) {
        return new Promise((resolve)=>{
            if (callback) {
                callback(null);
            }
            resolve();
        });
    }
    /**
   * Unlike Node, Deno does not require managing resource ids for reading
   * directories, and therefore does not need to close directories when
   * finished reading
   */ closeSync() {
    //No op
    }
    async *[Symbol.asyncIterator]() {
        try {
            while(true){
                const dirent = await this.read();
                if (dirent === null) {
                    break;
                }
                yield dirent;
            }
        } finally{
            await this.close();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19kaXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCBEaXJlbnQgZnJvbSBcIi4vX2ZzX2RpcmVudC50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcIi4uLy4uL191dGlsL2Fzc2VydHMudHNcIjtcbmltcG9ydCB7IEVSUl9NSVNTSU5HX0FSR1MgfSBmcm9tIFwiLi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERpciB7XG4gICNkaXJQYXRoOiBzdHJpbmcgfCBVaW50OEFycmF5O1xuICAjc3luY0l0ZXJhdG9yITogSXRlcmF0b3I8RGVuby5EaXJFbnRyeSwgdW5kZWZpbmVkPiB8IG51bGw7XG4gICNhc3luY0l0ZXJhdG9yITogQXN5bmNJdGVyYXRvcjxEZW5vLkRpckVudHJ5LCB1bmRlZmluZWQ+IHwgbnVsbDtcblxuICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcgfCBVaW50OEFycmF5KSB7XG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRVJSX01JU1NJTkdfQVJHUyhcInBhdGhcIik7XG4gICAgfVxuICAgIHRoaXMuI2RpclBhdGggPSBwYXRoO1xuICB9XG5cbiAgZ2V0IHBhdGgoKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy4jZGlyUGF0aCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUodGhpcy4jZGlyUGF0aCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiNkaXJQYXRoO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgcmVhZChjYWxsYmFjaz86ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZCk6IFByb21pc2U8RGlyZW50IHwgbnVsbD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIXRoaXMuI2FzeW5jSXRlcmF0b3IpIHtcbiAgICAgICAgdGhpcy4jYXN5bmNJdGVyYXRvciA9IERlbm8ucmVhZERpcih0aGlzLnBhdGgpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpO1xuICAgICAgfVxuICAgICAgYXNzZXJ0KHRoaXMuI2FzeW5jSXRlcmF0b3IpO1xuICAgICAgdGhpcy4jYXN5bmNJdGVyYXRvclxuICAgICAgICAubmV4dCgpXG4gICAgICAgIC50aGVuKChpdGVyYXRvclJlc3VsdCkgPT4ge1xuICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICBpdGVyYXRvclJlc3VsdC5kb25lID8gbnVsbCA6IG5ldyBEaXJlbnQoaXRlcmF0b3JSZXN1bHQudmFsdWUpLFxuICAgICAgICAgICk7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhcbiAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgaXRlcmF0b3JSZXN1bHQuZG9uZSA/IG51bGwgOiBuZXcgRGlyZW50KGl0ZXJhdG9yUmVzdWx0LnZhbHVlKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICByZWFkU3luYygpOiBEaXJlbnQgfCBudWxsIHtcbiAgICBpZiAoIXRoaXMuI3N5bmNJdGVyYXRvcikge1xuICAgICAgdGhpcy4jc3luY0l0ZXJhdG9yID0gRGVuby5yZWFkRGlyU3luYyh0aGlzLnBhdGgpIVtTeW1ib2wuaXRlcmF0b3JdKCk7XG4gICAgfVxuXG4gICAgY29uc3QgaXRlcmF0b3JSZXN1bHQgPSB0aGlzLiNzeW5jSXRlcmF0b3IubmV4dCgpO1xuICAgIGlmIChpdGVyYXRvclJlc3VsdC5kb25lKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBEaXJlbnQoaXRlcmF0b3JSZXN1bHQudmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVbmxpa2UgTm9kZSwgRGVubyBkb2VzIG5vdCByZXF1aXJlIG1hbmFnaW5nIHJlc291cmNlIGlkcyBmb3IgcmVhZGluZ1xuICAgKiBkaXJlY3RvcmllcywgYW5kIHRoZXJlZm9yZSBkb2VzIG5vdCBuZWVkIHRvIGNsb3NlIGRpcmVjdG9yaWVzIHdoZW5cbiAgICogZmluaXNoZWQgcmVhZGluZy5cbiAgICovXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNsb3NlKGNhbGxiYWNrPzogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICB9XG4gICAgICByZXNvbHZlKCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVW5saWtlIE5vZGUsIERlbm8gZG9lcyBub3QgcmVxdWlyZSBtYW5hZ2luZyByZXNvdXJjZSBpZHMgZm9yIHJlYWRpbmdcbiAgICogZGlyZWN0b3JpZXMsIGFuZCB0aGVyZWZvcmUgZG9lcyBub3QgbmVlZCB0byBjbG9zZSBkaXJlY3RvcmllcyB3aGVuXG4gICAqIGZpbmlzaGVkIHJlYWRpbmdcbiAgICovXG4gIGNsb3NlU3luYygpIHtcbiAgICAvL05vIG9wXG4gIH1cblxuICBhc3luYyAqW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8RGlyZW50PiB7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IGRpcmVudDogRGlyZW50IHwgbnVsbCA9IGF3YWl0IHRoaXMucmVhZCgpO1xuICAgICAgICBpZiAoZGlyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgeWllbGQgZGlyZW50O1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBhd2FpdCB0aGlzLmNsb3NlKCk7XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLE9BQU8sWUFBWSxrQkFBa0I7QUFDckMsU0FBUyxNQUFNLFFBQVEseUJBQXlCO0FBQ2hELFNBQVMsZ0JBQWdCLFFBQVEsd0JBQXdCO0FBRXpELGVBQWUsTUFBTTtJQUNuQixDQUFDLE9BQU8sQ0FBc0I7SUFDOUIsQ0FBQyxZQUFZLENBQTZDO0lBQzFELENBQUMsYUFBYSxDQUFrRDtJQUVoRSxZQUFZLElBQXlCLENBQUU7UUFDckMsSUFBSSxDQUFDLE1BQU07WUFDVCxNQUFNLElBQUksaUJBQWlCLFFBQVE7UUFDckMsQ0FBQztRQUNELElBQUksQ0FBQyxDQUFDLE9BQU8sR0FBRztJQUNsQjtJQUVBLElBQUksT0FBZTtRQUNqQixJQUFJLElBQUksQ0FBQyxDQUFDLE9BQU8sWUFBWSxZQUFZO1lBQ3ZDLE9BQU8sSUFBSSxjQUFjLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPO1FBQy9DLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxDQUFDLE9BQU87SUFDdEI7SUFFQSxtQ0FBbUM7SUFDbkMsS0FBSyxRQUFtQyxFQUEwQjtRQUNoRSxPQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsU0FBVztZQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxFQUFFO2dCQUN4QixJQUFJLENBQUMsQ0FBQyxhQUFhLEdBQUcsS0FBSyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sYUFBYSxDQUFDO1lBQ3JFLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQyxDQUFDLGFBQWE7WUFDMUIsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUNoQixJQUFJLEdBQ0osSUFBSSxDQUFDLENBQUMsaUJBQW1CO2dCQUN4QixRQUNFLGVBQWUsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLE9BQU8sZUFBZSxLQUFLLENBQUM7Z0JBRS9ELElBQUksVUFBVTtvQkFDWixTQUNFLElBQUksRUFDSixlQUFlLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxPQUFPLGVBQWUsS0FBSyxDQUFDO2dCQUVqRSxDQUFDO1lBQ0gsR0FBRyxDQUFDLE1BQVE7Z0JBQ1YsSUFBSSxVQUFVO29CQUNaLFNBQVM7Z0JBQ1gsQ0FBQztnQkFDRCxPQUFPO1lBQ1Q7UUFDSjtJQUNGO0lBRUEsV0FBMEI7UUFDeEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksRUFBRTtZQUN2QixJQUFJLENBQUMsQ0FBQyxZQUFZLEdBQUcsS0FBSyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBRSxDQUFDLE9BQU8sUUFBUSxDQUFDO1FBQ3BFLENBQUM7UUFFRCxNQUFNLGlCQUFpQixJQUFJLENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSTtRQUM5QyxJQUFJLGVBQWUsSUFBSSxFQUFFO1lBQ3ZCLE9BQU8sSUFBSTtRQUNiLE9BQU87WUFDTCxPQUFPLElBQUksT0FBTyxlQUFlLEtBQUs7UUFDeEMsQ0FBQztJQUNIO0lBRUE7Ozs7R0FJQyxHQUNELG1DQUFtQztJQUNuQyxNQUFNLFFBQW1DLEVBQWlCO1FBQ3hELE9BQU8sSUFBSSxRQUFRLENBQUMsVUFBWTtZQUM5QixJQUFJLFVBQVU7Z0JBQ1osU0FBUyxJQUFJO1lBQ2YsQ0FBQztZQUNEO1FBQ0Y7SUFDRjtJQUVBOzs7O0dBSUMsR0FDRCxZQUFZO0lBQ1YsT0FBTztJQUNUO0lBRUEsT0FBTyxDQUFDLE9BQU8sYUFBYSxDQUFDLEdBQWtDO1FBQzdELElBQUk7WUFDRixNQUFPLElBQUksQ0FBRTtnQkFDWCxNQUFNLFNBQXdCLE1BQU0sSUFBSSxDQUFDLElBQUk7Z0JBQzdDLElBQUksV0FBVyxJQUFJLEVBQUU7b0JBQ25CLEtBQU07Z0JBQ1IsQ0FBQztnQkFDRCxNQUFNO1lBQ1I7UUFDRixTQUFVO1lBQ1IsTUFBTSxJQUFJLENBQUMsS0FBSztRQUNsQjtJQUNGO0FBQ0YsQ0FBQyJ9