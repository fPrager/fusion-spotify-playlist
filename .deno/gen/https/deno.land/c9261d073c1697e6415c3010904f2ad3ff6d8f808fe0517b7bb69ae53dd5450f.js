// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { kKeyObject } from "./constants.ts";
export const kKeyType = Symbol("kKeyType");
export function isKeyObject(obj) {
    return obj != null && obj[kKeyType] !== undefined;
}
export function isCryptoKey(obj) {
    return obj != null && obj[kKeyObject] !== undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL19rZXlzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBrS2V5T2JqZWN0IH0gZnJvbSBcIi4vY29uc3RhbnRzLnRzXCI7XG5cbmV4cG9ydCBjb25zdCBrS2V5VHlwZSA9IFN5bWJvbChcImtLZXlUeXBlXCIpO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNLZXlPYmplY3Qob2JqOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgb2JqICE9IG51bGwgJiYgKG9iaiBhcyBSZWNvcmQ8c3ltYm9sLCB1bmtub3duPilba0tleVR5cGVdICE9PSB1bmRlZmluZWRcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQ3J5cHRvS2V5KG9iajogdW5rbm93bik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIG9iaiAhPSBudWxsICYmIChvYmogYXMgUmVjb3JkPHN5bWJvbCwgdW5rbm93bj4pW2tLZXlPYmplY3RdICE9PSB1bmRlZmluZWRcbiAgKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FBUyxVQUFVLFFBQVEsaUJBQWlCO0FBRTVDLE9BQU8sTUFBTSxXQUFXLE9BQU8sWUFBWTtBQUUzQyxPQUFPLFNBQVMsWUFBWSxHQUFZLEVBQVc7SUFDakQsT0FDRSxPQUFPLElBQUksSUFBSSxBQUFDLEdBQStCLENBQUMsU0FBUyxLQUFLO0FBRWxFLENBQUM7QUFFRCxPQUFPLFNBQVMsWUFBWSxHQUFZLEVBQVc7SUFDakQsT0FDRSxPQUFPLElBQUksSUFBSSxBQUFDLEdBQStCLENBQUMsV0FBVyxLQUFLO0FBRXBFLENBQUMifQ==