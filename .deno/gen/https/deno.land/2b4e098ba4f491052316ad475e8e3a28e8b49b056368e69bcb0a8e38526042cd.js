// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.
import { notImplemented } from "../../_utils.ts";
import { validateString } from "../validators.mjs";
import Writable from "../streams/writable.mjs";
export class Sign extends Writable {
    constructor(algorithm, _options){
        validateString(algorithm, "algorithm");
        super();
        notImplemented("crypto.Sign");
    }
    sign(_privateKey, _outputEncoding) {
        notImplemented("crypto.Sign.prototype.sign");
    }
    update(_data, _inputEncoding) {
        notImplemented("crypto.Sign.prototype.update");
    }
}
export class Verify extends Writable {
    constructor(algorithm, _options){
        validateString(algorithm, "algorithm");
        super();
        notImplemented("crypto.Verify");
    }
    update(_data, _inputEncoding) {
        notImplemented("crypto.Sign.prototype.update");
    }
    verify(_object, _signature, _signatureEncoding) {
        notImplemented("crypto.Sign.prototype.sign");
    }
}
export function signOneShot(_algorithm, _data, _key, _callback) {
    notImplemented("crypto.sign");
}
export function verifyOneShot(_algorithm, _data, _key, _signature, _callback) {
    notImplemented("crypto.verify");
}
export default {
    signOneShot,
    verifyOneShot,
    Sign,
    Verify
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvaW50ZXJuYWwvY3J5cHRvL3NpZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgTm9kZS5qcyBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBub3RJbXBsZW1lbnRlZCB9IGZyb20gXCIuLi8uLi9fdXRpbHMudHNcIjtcbmltcG9ydCB7IHZhbGlkYXRlU3RyaW5nIH0gZnJvbSBcIi4uL3ZhbGlkYXRvcnMubWpzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgdHlwZSB7IFdyaXRhYmxlT3B0aW9ucyB9IGZyb20gXCIuLi8uLi9fc3RyZWFtLmQudHNcIjtcbmltcG9ydCBXcml0YWJsZSBmcm9tIFwiLi4vc3RyZWFtcy93cml0YWJsZS5tanNcIjtcbmltcG9ydCB0eXBlIHtcbiAgQmluYXJ5TGlrZSxcbiAgQmluYXJ5VG9UZXh0RW5jb2RpbmcsXG4gIEVuY29kaW5nLFxuICBQcml2YXRlS2V5SW5wdXQsXG4gIFB1YmxpY0tleUlucHV0LFxufSBmcm9tIFwiLi90eXBlcy50c1wiO1xuaW1wb3J0IHsgS2V5T2JqZWN0IH0gZnJvbSBcIi4va2V5cy50c1wiO1xuXG5leHBvcnQgdHlwZSBEU0FFbmNvZGluZyA9IFwiZGVyXCIgfCBcImllZWUtcDEzNjNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTaWduaW5nT3B0aW9ucyB7XG4gIHBhZGRpbmc/OiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIHNhbHRMZW5ndGg/OiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIGRzYUVuY29kaW5nPzogRFNBRW5jb2RpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2lnblByaXZhdGVLZXlJbnB1dCBleHRlbmRzIFByaXZhdGVLZXlJbnB1dCwgU2lnbmluZ09wdGlvbnMge31cblxuZXhwb3J0IGludGVyZmFjZSBTaWduS2V5T2JqZWN0SW5wdXQgZXh0ZW5kcyBTaWduaW5nT3B0aW9ucyB7XG4gIGtleTogS2V5T2JqZWN0O1xufVxuZXhwb3J0IGludGVyZmFjZSBWZXJpZnlQdWJsaWNLZXlJbnB1dCBleHRlbmRzIFB1YmxpY0tleUlucHV0LCBTaWduaW5nT3B0aW9ucyB7fVxuXG5leHBvcnQgaW50ZXJmYWNlIFZlcmlmeUtleU9iamVjdElucHV0IGV4dGVuZHMgU2lnbmluZ09wdGlvbnMge1xuICBrZXk6IEtleU9iamVjdDtcbn1cblxuZXhwb3J0IHR5cGUgS2V5TGlrZSA9IHN0cmluZyB8IEJ1ZmZlciB8IEtleU9iamVjdDtcblxuZXhwb3J0IGNsYXNzIFNpZ24gZXh0ZW5kcyBXcml0YWJsZSB7XG4gIGNvbnN0cnVjdG9yKGFsZ29yaXRobTogc3RyaW5nLCBfb3B0aW9ucz86IFdyaXRhYmxlT3B0aW9ucykge1xuICAgIHZhbGlkYXRlU3RyaW5nKGFsZ29yaXRobSwgXCJhbGdvcml0aG1cIik7XG5cbiAgICBzdXBlcigpO1xuXG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uU2lnblwiKTtcbiAgfVxuXG4gIHNpZ24ocHJpdmF0ZUtleTogS2V5TGlrZSB8IFNpZ25LZXlPYmplY3RJbnB1dCB8IFNpZ25Qcml2YXRlS2V5SW5wdXQpOiBCdWZmZXI7XG4gIHNpZ24oXG4gICAgcHJpdmF0ZUtleTogS2V5TGlrZSB8IFNpZ25LZXlPYmplY3RJbnB1dCB8IFNpZ25Qcml2YXRlS2V5SW5wdXQsXG4gICAgb3V0cHV0Rm9ybWF0OiBCaW5hcnlUb1RleHRFbmNvZGluZyxcbiAgKTogc3RyaW5nO1xuICBzaWduKFxuICAgIF9wcml2YXRlS2V5OiBLZXlMaWtlIHwgU2lnbktleU9iamVjdElucHV0IHwgU2lnblByaXZhdGVLZXlJbnB1dCxcbiAgICBfb3V0cHV0RW5jb2Rpbmc/OiBCaW5hcnlUb1RleHRFbmNvZGluZyxcbiAgKTogQnVmZmVyIHwgc3RyaW5nIHtcbiAgICBub3RJbXBsZW1lbnRlZChcImNyeXB0by5TaWduLnByb3RvdHlwZS5zaWduXCIpO1xuICB9XG5cbiAgdXBkYXRlKGRhdGE6IEJpbmFyeUxpa2UpOiB0aGlzO1xuICB1cGRhdGUoZGF0YTogc3RyaW5nLCBpbnB1dEVuY29kaW5nOiBFbmNvZGluZyk6IHRoaXM7XG4gIHVwZGF0ZShfZGF0YTogQmluYXJ5TGlrZSB8IHN0cmluZywgX2lucHV0RW5jb2Rpbmc/OiBFbmNvZGluZyk6IHRoaXMge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlNpZ24ucHJvdG90eXBlLnVwZGF0ZVwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmVyaWZ5IGV4dGVuZHMgV3JpdGFibGUge1xuICBjb25zdHJ1Y3RvcihhbGdvcml0aG06IHN0cmluZywgX29wdGlvbnM/OiBXcml0YWJsZU9wdGlvbnMpIHtcbiAgICB2YWxpZGF0ZVN0cmluZyhhbGdvcml0aG0sIFwiYWxnb3JpdGhtXCIpO1xuXG4gICAgc3VwZXIoKTtcblxuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlZlcmlmeVwiKTtcbiAgfVxuXG4gIHVwZGF0ZShkYXRhOiBCaW5hcnlMaWtlKTogdGhpcztcbiAgdXBkYXRlKGRhdGE6IHN0cmluZywgaW5wdXRFbmNvZGluZzogRW5jb2RpbmcpOiB0aGlzO1xuICB1cGRhdGUoX2RhdGE6IEJpbmFyeUxpa2UsIF9pbnB1dEVuY29kaW5nPzogc3RyaW5nKTogdGhpcyB7XG4gICAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uU2lnbi5wcm90b3R5cGUudXBkYXRlXCIpO1xuICB9XG5cbiAgdmVyaWZ5KFxuICAgIG9iamVjdDogS2V5TGlrZSB8IFZlcmlmeUtleU9iamVjdElucHV0IHwgVmVyaWZ5UHVibGljS2V5SW5wdXQsXG4gICAgc2lnbmF0dXJlOiBBcnJheUJ1ZmZlclZpZXcsXG4gICk6IGJvb2xlYW47XG4gIHZlcmlmeShcbiAgICBvYmplY3Q6IEtleUxpa2UgfCBWZXJpZnlLZXlPYmplY3RJbnB1dCB8IFZlcmlmeVB1YmxpY0tleUlucHV0LFxuICAgIHNpZ25hdHVyZTogc3RyaW5nLFxuICAgIHNpZ25hdHVyZUVuY29kaW5nPzogQmluYXJ5VG9UZXh0RW5jb2RpbmcsXG4gICk6IGJvb2xlYW47XG4gIHZlcmlmeShcbiAgICBfb2JqZWN0OiBLZXlMaWtlIHwgVmVyaWZ5S2V5T2JqZWN0SW5wdXQgfCBWZXJpZnlQdWJsaWNLZXlJbnB1dCxcbiAgICBfc2lnbmF0dXJlOiBBcnJheUJ1ZmZlclZpZXcgfCBzdHJpbmcsXG4gICAgX3NpZ25hdHVyZUVuY29kaW5nPzogQmluYXJ5VG9UZXh0RW5jb2RpbmcsXG4gICk6IGJvb2xlYW4ge1xuICAgIG5vdEltcGxlbWVudGVkKFwiY3J5cHRvLlNpZ24ucHJvdG90eXBlLnNpZ25cIik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25PbmVTaG90KFxuICBhbGdvcml0aG06IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsXG4gIGRhdGE6IEFycmF5QnVmZmVyVmlldyxcbiAga2V5OiBLZXlMaWtlIHwgU2lnbktleU9iamVjdElucHV0IHwgU2lnblByaXZhdGVLZXlJbnB1dCxcbik6IEJ1ZmZlcjtcbmV4cG9ydCBmdW5jdGlvbiBzaWduT25lU2hvdChcbiAgYWxnb3JpdGhtOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLFxuICBkYXRhOiBBcnJheUJ1ZmZlclZpZXcsXG4gIGtleTogS2V5TGlrZSB8IFNpZ25LZXlPYmplY3RJbnB1dCB8IFNpZ25Qcml2YXRlS2V5SW5wdXQsXG4gIGNhbGxiYWNrOiAoZXJyb3I6IEVycm9yIHwgbnVsbCwgZGF0YTogQnVmZmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiBzaWduT25lU2hvdChcbiAgX2FsZ29yaXRobTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgX2RhdGE6IEFycmF5QnVmZmVyVmlldyxcbiAgX2tleTogS2V5TGlrZSB8IFNpZ25LZXlPYmplY3RJbnB1dCB8IFNpZ25Qcml2YXRlS2V5SW5wdXQsXG4gIF9jYWxsYmFjaz86IChlcnJvcjogRXJyb3IgfCBudWxsLCBkYXRhOiBCdWZmZXIpID0+IHZvaWQsXG4pOiBCdWZmZXIgfCB2b2lkIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8uc2lnblwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeU9uZVNob3QoXG4gIGFsZ29yaXRobTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgZGF0YTogQXJyYXlCdWZmZXJWaWV3LFxuICBrZXk6IEtleUxpa2UgfCBWZXJpZnlLZXlPYmplY3RJbnB1dCB8IFZlcmlmeVB1YmxpY0tleUlucHV0LFxuICBzaWduYXR1cmU6IEFycmF5QnVmZmVyVmlldyxcbik6IGJvb2xlYW47XG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5T25lU2hvdChcbiAgYWxnb3JpdGhtOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLFxuICBkYXRhOiBBcnJheUJ1ZmZlclZpZXcsXG4gIGtleTogS2V5TGlrZSB8IFZlcmlmeUtleU9iamVjdElucHV0IHwgVmVyaWZ5UHVibGljS2V5SW5wdXQsXG4gIHNpZ25hdHVyZTogQXJyYXlCdWZmZXJWaWV3LFxuICBjYWxsYmFjazogKGVycm9yOiBFcnJvciB8IG51bGwsIHJlc3VsdDogYm9vbGVhbikgPT4gdm9pZCxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5T25lU2hvdChcbiAgX2FsZ29yaXRobTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgX2RhdGE6IEFycmF5QnVmZmVyVmlldyxcbiAgX2tleTogS2V5TGlrZSB8IFZlcmlmeUtleU9iamVjdElucHV0IHwgVmVyaWZ5UHVibGljS2V5SW5wdXQsXG4gIF9zaWduYXR1cmU6IEFycmF5QnVmZmVyVmlldyxcbiAgX2NhbGxiYWNrPzogKGVycm9yOiBFcnJvciB8IG51bGwsIHJlc3VsdDogYm9vbGVhbikgPT4gdm9pZCxcbik6IGJvb2xlYW4gfCB2b2lkIHtcbiAgbm90SW1wbGVtZW50ZWQoXCJjcnlwdG8udmVyaWZ5XCIpO1xufVxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHNpZ25PbmVTaG90LFxuICB2ZXJpZnlPbmVTaG90LFxuICBTaWduLFxuICBWZXJpZnksXG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxRkFBcUY7QUFFckYsU0FBUyxjQUFjLFFBQVEsa0JBQWtCO0FBQ2pELFNBQVMsY0FBYyxRQUFRLG9CQUFvQjtBQUduRCxPQUFPLGNBQWMsMEJBQTBCO0FBK0IvQyxPQUFPLE1BQU0sYUFBYTtJQUN4QixZQUFZLFNBQWlCLEVBQUUsUUFBMEIsQ0FBRTtRQUN6RCxlQUFlLFdBQVc7UUFFMUIsS0FBSztRQUVMLGVBQWU7SUFDakI7SUFPQSxLQUNFLFdBQStELEVBQy9ELGVBQXNDLEVBQ3JCO1FBQ2pCLGVBQWU7SUFDakI7SUFJQSxPQUFPLEtBQTBCLEVBQUUsY0FBeUIsRUFBUTtRQUNsRSxlQUFlO0lBQ2pCO0FBQ0YsQ0FBQztBQUVELE9BQU8sTUFBTSxlQUFlO0lBQzFCLFlBQVksU0FBaUIsRUFBRSxRQUEwQixDQUFFO1FBQ3pELGVBQWUsV0FBVztRQUUxQixLQUFLO1FBRUwsZUFBZTtJQUNqQjtJQUlBLE9BQU8sS0FBaUIsRUFBRSxjQUF1QixFQUFRO1FBQ3ZELGVBQWU7SUFDakI7SUFXQSxPQUNFLE9BQThELEVBQzlELFVBQW9DLEVBQ3BDLGtCQUF5QyxFQUNoQztRQUNULGVBQWU7SUFDakI7QUFDRixDQUFDO0FBYUQsT0FBTyxTQUFTLFlBQ2QsVUFBcUMsRUFDckMsS0FBc0IsRUFDdEIsSUFBd0QsRUFDeEQsU0FBdUQsRUFDeEM7SUFDZixlQUFlO0FBQ2pCLENBQUM7QUFlRCxPQUFPLFNBQVMsY0FDZCxVQUFxQyxFQUNyQyxLQUFzQixFQUN0QixJQUEyRCxFQUMzRCxVQUEyQixFQUMzQixTQUEwRCxFQUMxQztJQUNoQixlQUFlO0FBQ2pCLENBQUM7QUFFRCxlQUFlO0lBQ2I7SUFDQTtJQUNBO0lBQ0E7QUFDRixFQUFFIn0=