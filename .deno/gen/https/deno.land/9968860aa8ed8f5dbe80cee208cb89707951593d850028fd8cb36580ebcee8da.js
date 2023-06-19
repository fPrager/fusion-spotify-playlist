// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { validateRmOptions, validateRmOptionsSync } from "../internal/fs/utils.mjs";
import { denoErrorToNodeError } from "../internal/errors.ts";
import { promisify } from "../internal/util.mjs";
export function rm(path, optionsOrCallback, maybeCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === "object" ? optionsOrCallback : undefined;
    if (!callback) throw new Error("No callback function supplied");
    validateRmOptions(path, options, false, (err, options)=>{
        if (err) {
            return callback(err);
        }
        Deno.remove(path, {
            recursive: options?.recursive
        }).then((_)=>callback(null), (err)=>{
            if (options?.force && err instanceof Deno.errors.NotFound) {
                callback(null);
            } else {
                callback(err instanceof Error ? denoErrorToNodeError(err, {
                    syscall: "rm"
                }) : err);
            }
        });
    });
}
export const rmPromise = promisify(rm);
export function rmSync(path, options) {
    options = validateRmOptionsSync(path, options, false);
    try {
        Deno.removeSync(path, {
            recursive: options?.recursive
        });
    } catch (err) {
        if (options?.force && err instanceof Deno.errors.NotFound) {
            return;
        }
        if (err instanceof Error) {
            throw denoErrorToNodeError(err, {
                syscall: "stat"
            });
        } else {
            throw err;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvX2ZzL19mc19ybS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHtcbiAgdmFsaWRhdGVSbU9wdGlvbnMsXG4gIHZhbGlkYXRlUm1PcHRpb25zU3luYyxcbn0gZnJvbSBcIi4uL2ludGVybmFsL2ZzL3V0aWxzLm1qc1wiO1xuaW1wb3J0IHsgZGVub0Vycm9yVG9Ob2RlRXJyb3IgfSBmcm9tIFwiLi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tIFwiLi4vaW50ZXJuYWwvdXRpbC5tanNcIjtcblxudHlwZSBybU9wdGlvbnMgPSB7XG4gIGZvcmNlPzogYm9vbGVhbjtcbiAgbWF4UmV0cmllcz86IG51bWJlcjtcbiAgcmVjdXJzaXZlPzogYm9vbGVhbjtcbiAgcmV0cnlEZWxheT86IG51bWJlcjtcbn07XG5cbnR5cGUgcm1DYWxsYmFjayA9IChlcnI6IEVycm9yIHwgbnVsbCkgPT4gdm9pZDtcblxuZXhwb3J0IGZ1bmN0aW9uIHJtKHBhdGg6IHN0cmluZyB8IFVSTCwgY2FsbGJhY2s6IHJtQ2FsbGJhY2spOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIHJtKFxuICBwYXRoOiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnM6IHJtT3B0aW9ucyxcbiAgY2FsbGJhY2s6IHJtQ2FsbGJhY2ssXG4pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIHJtKFxuICBwYXRoOiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnNPckNhbGxiYWNrOiBybU9wdGlvbnMgfCBybUNhbGxiYWNrLFxuICBtYXliZUNhbGxiYWNrPzogcm1DYWxsYmFjayxcbikge1xuICBjb25zdCBjYWxsYmFjayA9IHR5cGVvZiBvcHRpb25zT3JDYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiXG4gICAgPyBvcHRpb25zT3JDYWxsYmFja1xuICAgIDogbWF5YmVDYWxsYmFjaztcbiAgY29uc3Qgb3B0aW9ucyA9IHR5cGVvZiBvcHRpb25zT3JDYWxsYmFjayA9PT0gXCJvYmplY3RcIlxuICAgID8gb3B0aW9uc09yQ2FsbGJhY2tcbiAgICA6IHVuZGVmaW5lZDtcblxuICBpZiAoIWNhbGxiYWNrKSB0aHJvdyBuZXcgRXJyb3IoXCJObyBjYWxsYmFjayBmdW5jdGlvbiBzdXBwbGllZFwiKTtcblxuICB2YWxpZGF0ZVJtT3B0aW9ucyhcbiAgICBwYXRoLFxuICAgIG9wdGlvbnMsXG4gICAgZmFsc2UsXG4gICAgKGVycjogRXJyb3IgfCBudWxsLCBvcHRpb25zOiBybU9wdGlvbnMpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICB9XG4gICAgICBEZW5vLnJlbW92ZShwYXRoLCB7IHJlY3Vyc2l2ZTogb3B0aW9ucz8ucmVjdXJzaXZlIH0pXG4gICAgICAgIC50aGVuKChfKSA9PiBjYWxsYmFjayhudWxsKSwgKGVycjogdW5rbm93bikgPT4ge1xuICAgICAgICAgIGlmIChvcHRpb25zPy5mb3JjZSAmJiBlcnIgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RGb3VuZCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKFxuICAgICAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBFcnJvclxuICAgICAgICAgICAgICAgID8gZGVub0Vycm9yVG9Ob2RlRXJyb3IoZXJyLCB7IHN5c2NhbGw6IFwicm1cIiB9KVxuICAgICAgICAgICAgICAgIDogZXJyLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICk7XG59XG5cbmV4cG9ydCBjb25zdCBybVByb21pc2UgPSBwcm9taXNpZnkocm0pIGFzIChcbiAgcGF0aDogc3RyaW5nIHwgVVJMLFxuICBvcHRpb25zPzogcm1PcHRpb25zLFxuKSA9PiBQcm9taXNlPHZvaWQ+O1xuXG5leHBvcnQgZnVuY3Rpb24gcm1TeW5jKHBhdGg6IHN0cmluZyB8IFVSTCwgb3B0aW9ucz86IHJtT3B0aW9ucykge1xuICBvcHRpb25zID0gdmFsaWRhdGVSbU9wdGlvbnNTeW5jKHBhdGgsIG9wdGlvbnMsIGZhbHNlKTtcbiAgdHJ5IHtcbiAgICBEZW5vLnJlbW92ZVN5bmMocGF0aCwgeyByZWN1cnNpdmU6IG9wdGlvbnM/LnJlY3Vyc2l2ZSB9KTtcbiAgfSBjYXRjaCAoZXJyOiB1bmtub3duKSB7XG4gICAgaWYgKG9wdGlvbnM/LmZvcmNlICYmIGVyciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgdGhyb3cgZGVub0Vycm9yVG9Ob2RlRXJyb3IoZXJyLCB7IHN5c2NhbGw6IFwic3RhdFwiIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBQ0UsaUJBQWlCLEVBQ2pCLHFCQUFxQixRQUNoQiwyQkFBMkI7QUFDbEMsU0FBUyxvQkFBb0IsUUFBUSx3QkFBd0I7QUFDN0QsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBaUJqRCxPQUFPLFNBQVMsR0FDZCxJQUFrQixFQUNsQixpQkFBeUMsRUFDekMsYUFBMEIsRUFDMUI7SUFDQSxNQUFNLFdBQVcsT0FBTyxzQkFBc0IsYUFDMUMsb0JBQ0EsYUFBYTtJQUNqQixNQUFNLFVBQVUsT0FBTyxzQkFBc0IsV0FDekMsb0JBQ0EsU0FBUztJQUViLElBQUksQ0FBQyxVQUFVLE1BQU0sSUFBSSxNQUFNLGlDQUFpQztJQUVoRSxrQkFDRSxNQUNBLFNBQ0EsS0FBSyxFQUNMLENBQUMsS0FBbUIsVUFBdUI7UUFDekMsSUFBSSxLQUFLO1lBQ1AsT0FBTyxTQUFTO1FBQ2xCLENBQUM7UUFDRCxLQUFLLE1BQU0sQ0FBQyxNQUFNO1lBQUUsV0FBVyxTQUFTO1FBQVUsR0FDL0MsSUFBSSxDQUFDLENBQUMsSUFBTSxTQUFTLElBQUksR0FBRyxDQUFDLE1BQWlCO1lBQzdDLElBQUksU0FBUyxTQUFTLGVBQWUsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFO2dCQUN6RCxTQUFTLElBQUk7WUFDZixPQUFPO2dCQUNMLFNBQ0UsZUFBZSxRQUNYLHFCQUFxQixLQUFLO29CQUFFLFNBQVM7Z0JBQUssS0FDMUMsR0FBRztZQUVYLENBQUM7UUFDSDtJQUNKO0FBRUosQ0FBQztBQUVELE9BQU8sTUFBTSxZQUFZLFVBQVUsSUFHaEI7QUFFbkIsT0FBTyxTQUFTLE9BQU8sSUFBa0IsRUFBRSxPQUFtQixFQUFFO0lBQzlELFVBQVUsc0JBQXNCLE1BQU0sU0FBUyxLQUFLO0lBQ3BELElBQUk7UUFDRixLQUFLLFVBQVUsQ0FBQyxNQUFNO1lBQUUsV0FBVyxTQUFTO1FBQVU7SUFDeEQsRUFBRSxPQUFPLEtBQWM7UUFDckIsSUFBSSxTQUFTLFNBQVMsZUFBZSxLQUFLLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFDekQ7UUFDRixDQUFDO1FBQ0QsSUFBSSxlQUFlLE9BQU87WUFDeEIsTUFBTSxxQkFBcUIsS0FBSztnQkFBRSxTQUFTO1lBQU8sR0FBRztRQUN2RCxPQUFPO1lBQ0wsTUFBTSxJQUFJO1FBQ1osQ0FBQztJQUNIO0FBQ0YsQ0FBQyJ9