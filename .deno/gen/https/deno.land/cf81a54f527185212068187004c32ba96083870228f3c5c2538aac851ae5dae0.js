// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/**
 * Applies the given transformer to all values in the given record and returns a
 * new record containing the resulting keys associated to the last value that
 * produced them.
 *
 * @example
 * ```ts
 * import { mapValues } from "https://deno.land/std@$STD_VERSION/collections/map_values.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * const usersById = {
 *   "a5ec": { name: "Mischa" },
 *   "de4f": { name: "Kim" },
 * };
 * const namesById = mapValues(usersById, (it) => it.name);
 *
 * assertEquals(
 *   namesById,
 *   {
 *     "a5ec": "Mischa",
 *     "de4f": "Kim",
 *   },
 * );
 * ```
 */ export function mapValues(record, transformer) {
    const ret = {};
    const entries = Object.entries(record);
    for (const [key, value] of entries){
        const mappedValue = transformer(value);
        ret[key] = mappedValue;
    }
    return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL2NvbGxlY3Rpb25zL21hcF92YWx1ZXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuLyoqXG4gKiBBcHBsaWVzIHRoZSBnaXZlbiB0cmFuc2Zvcm1lciB0byBhbGwgdmFsdWVzIGluIHRoZSBnaXZlbiByZWNvcmQgYW5kIHJldHVybnMgYVxuICogbmV3IHJlY29yZCBjb250YWluaW5nIHRoZSByZXN1bHRpbmcga2V5cyBhc3NvY2lhdGVkIHRvIHRoZSBsYXN0IHZhbHVlIHRoYXRcbiAqIHByb2R1Y2VkIHRoZW0uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBtYXBWYWx1ZXMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9jb2xsZWN0aW9ucy9tYXBfdmFsdWVzLnRzXCI7XG4gKiBpbXBvcnQgeyBhc3NlcnRFcXVhbHMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi90ZXN0aW5nL2Fzc2VydHMudHNcIjtcbiAqXG4gKiBjb25zdCB1c2Vyc0J5SWQgPSB7XG4gKiAgIFwiYTVlY1wiOiB7IG5hbWU6IFwiTWlzY2hhXCIgfSxcbiAqICAgXCJkZTRmXCI6IHsgbmFtZTogXCJLaW1cIiB9LFxuICogfTtcbiAqIGNvbnN0IG5hbWVzQnlJZCA9IG1hcFZhbHVlcyh1c2Vyc0J5SWQsIChpdCkgPT4gaXQubmFtZSk7XG4gKlxuICogYXNzZXJ0RXF1YWxzKFxuICogICBuYW1lc0J5SWQsXG4gKiAgIHtcbiAqICAgICBcImE1ZWNcIjogXCJNaXNjaGFcIixcbiAqICAgICBcImRlNGZcIjogXCJLaW1cIixcbiAqICAgfSxcbiAqICk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hcFZhbHVlczxULCBPPihcbiAgcmVjb3JkOiBSZWFkb25seTxSZWNvcmQ8c3RyaW5nLCBUPj4sXG4gIHRyYW5zZm9ybWVyOiAodmFsdWU6IFQpID0+IE8sXG4pOiBSZWNvcmQ8c3RyaW5nLCBPPiB7XG4gIGNvbnN0IHJldDogUmVjb3JkPHN0cmluZywgTz4gPSB7fTtcbiAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHJlY29yZCk7XG5cbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZW50cmllcykge1xuICAgIGNvbnN0IG1hcHBlZFZhbHVlID0gdHJhbnNmb3JtZXIodmFsdWUpO1xuXG4gICAgcmV0W2tleV0gPSBtYXBwZWRWYWx1ZTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFDQUFxQztBQUVyQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBd0JDLEdBQ0QsT0FBTyxTQUFTLFVBQ2QsTUFBbUMsRUFDbkMsV0FBNEIsRUFDVDtJQUNuQixNQUFNLE1BQXlCLENBQUM7SUFDaEMsTUFBTSxVQUFVLE9BQU8sT0FBTyxDQUFDO0lBRS9CLEtBQUssTUFBTSxDQUFDLEtBQUssTUFBTSxJQUFJLFFBQVM7UUFDbEMsTUFBTSxjQUFjLFlBQVk7UUFFaEMsR0FBRyxDQUFDLElBQUksR0FBRztJQUNiO0lBRUEsT0FBTztBQUNULENBQUMifQ==