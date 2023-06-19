// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
import { Buffer } from "./buffer.ts";
import { normalizeEncoding as castEncoding, notImplemented } from "./_utils.ts";
var NotImplemented;
(function(NotImplemented) {
    NotImplemented[NotImplemented["ascii"] = 0] = "ascii";
    NotImplemented[NotImplemented["latin1"] = 1] = "latin1";
    NotImplemented[NotImplemented["utf16le"] = 2] = "utf16le";
})(NotImplemented || (NotImplemented = {}));
function normalizeEncoding(enc) {
    const encoding = castEncoding(enc ?? null);
    if (encoding && encoding in NotImplemented) notImplemented(encoding);
    if (!encoding && typeof enc === "string" && enc.toLowerCase() !== "raw") {
        throw new Error(`Unknown encoding: ${enc}`);
    }
    return String(encoding);
}
/**
 * Check is `ArrayBuffer` and not `TypedArray`. Typescript allowed `TypedArray` to be passed as `ArrayBuffer` and does not do a deep check
 */ function isBufferType(buf) {
    return buf instanceof ArrayBuffer && buf.BYTES_PER_ELEMENT;
}
/*
 * Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
 * continuation byte. If an invalid byte is detected, -2 is returned.
 * */ function utf8CheckByte(byte) {
    if (byte <= 0x7f) return 0;
    else if (byte >> 5 === 0x06) return 2;
    else if (byte >> 4 === 0x0e) return 3;
    else if (byte >> 3 === 0x1e) return 4;
    return byte >> 6 === 0x02 ? -1 : -2;
}
/*
 * Checks at most 3 bytes at the end of a Buffer in order to detect an
 * incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
 * needed to complete the UTF-8 character (if applicable) are returned.
 * */ function utf8CheckIncomplete(self, buf, i) {
    let j = buf.length - 1;
    if (j < i) return 0;
    let nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
        if (nb > 0) self.lastNeed = nb - 1;
        return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
        if (nb > 0) self.lastNeed = nb - 2;
        return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
        if (nb > 0) {
            if (nb === 2) nb = 0;
            else self.lastNeed = nb - 3;
        }
        return nb;
    }
    return 0;
}
/*
 * Validates as many continuation bytes for a multi-byte UTF-8 character as
 * needed or are available. If we see a non-continuation byte where we expect
 * one, we "replace" the validated continuation bytes we've seen so far with
 * a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
 * behavior. The continuation byte check is included three times in the case
 * where all of the continuation bytes for a character exist in the same buffer.
 * It is also done this way as a slight performance increase instead of using a
 * loop.
 * */ function utf8CheckExtraBytes(self, buf) {
    if ((buf[0] & 0xc0) !== 0x80) {
        self.lastNeed = 0;
        return "\ufffd";
    }
    if (self.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 0xc0) !== 0x80) {
            self.lastNeed = 1;
            return "\ufffd";
        }
        if (self.lastNeed > 2 && buf.length > 2) {
            if ((buf[2] & 0xc0) !== 0x80) {
                self.lastNeed = 2;
                return "\ufffd";
            }
        }
    }
}
/*
 * Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
 * */ function utf8FillLastComplete(buf) {
    const p = this.lastTotal - this.lastNeed;
    const r = utf8CheckExtraBytes(this, buf);
    if (r !== undefined) return r;
    if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, p, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, p, 0, buf.length);
    this.lastNeed -= buf.length;
}
/*
 * Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
 * */ function utf8FillLastIncomplete(buf) {
    if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
    this.lastNeed -= buf.length;
}
/*
 * Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
 * partial character, the character's bytes are buffered until the required
 * number of bytes are available.
 * */ function utf8Text(buf, i) {
    const total = utf8CheckIncomplete(this, buf, i);
    if (!this.lastNeed) return buf.toString("utf8", i);
    this.lastTotal = total;
    const end = buf.length - (total - this.lastNeed);
    buf.copy(this.lastChar, 0, end);
    return buf.toString("utf8", i, end);
}
/*
 * For UTF-8, a replacement character is added when ending on a partial
 * character.
 * */ function utf8End(buf) {
    const r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + "\ufffd";
    return r;
}
function utf8Write(buf) {
    if (typeof buf === "string") {
        return buf;
    }
    if (buf.length === 0) return "";
    let r;
    let i;
    // Because `TypedArray` is recognized as `ArrayBuffer` but in the reality, there are some fundamental difference. We would need to cast it properly
    const normalizedBuffer = isBufferType(buf) ? buf : Buffer.from(buf);
    if (this.lastNeed) {
        r = this.fillLast(normalizedBuffer);
        if (r === undefined) return "";
        i = this.lastNeed;
        this.lastNeed = 0;
    } else {
        i = 0;
    }
    if (i < buf.length) {
        return r ? r + this.text(normalizedBuffer, i) : this.text(normalizedBuffer, i);
    }
    return r || "";
}
function base64Text(buf, i) {
    const n = (buf.length - i) % 3;
    if (n === 0) return buf.toString("base64", i);
    this.lastNeed = 3 - n;
    this.lastTotal = 3;
    if (n === 1) {
        this.lastChar[0] = buf[buf.length - 1];
    } else {
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
    }
    return buf.toString("base64", i, buf.length - n);
}
function base64End(buf) {
    const r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) {
        return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
    }
    return r;
}
function simpleWrite(buf) {
    if (typeof buf === "string") {
        return buf;
    }
    return buf.toString(this.encoding);
}
function simpleEnd(buf) {
    return buf && buf.length ? this.write(buf) : "";
}
class StringDecoderBase {
    lastChar;
    lastNeed;
    lastTotal;
    constructor(encoding, nb){
        this.encoding = encoding;
        this.lastNeed = 0;
        this.lastTotal = 0;
        this.lastChar = Buffer.allocUnsafe(nb);
    }
    encoding;
}
class Base64Decoder extends StringDecoderBase {
    end = base64End;
    fillLast = utf8FillLastIncomplete;
    text = base64Text;
    write = utf8Write;
    constructor(encoding){
        super(normalizeEncoding(encoding), 3);
    }
}
class GenericDecoder extends StringDecoderBase {
    end = simpleEnd;
    fillLast = undefined;
    text = utf8Text;
    write = simpleWrite;
    constructor(encoding){
        super(normalizeEncoding(encoding), 4);
    }
}
class Utf8Decoder extends StringDecoderBase {
    end = utf8End;
    fillLast = utf8FillLastComplete;
    text = utf8Text;
    write = utf8Write;
    constructor(encoding){
        super(normalizeEncoding(encoding), 4);
    }
}
/*
 * StringDecoder provides an interface for efficiently splitting a series of
 * buffers into a series of JS strings without breaking apart multi-byte
 * characters.
 * */ export class StringDecoder {
    encoding;
    end;
    fillLast;
    lastChar;
    lastNeed;
    lastTotal;
    text;
    write;
    constructor(encoding){
        const normalizedEncoding = normalizeEncoding(encoding);
        let decoder;
        switch(normalizedEncoding){
            case "utf8":
                decoder = new Utf8Decoder(encoding);
                break;
            case "base64":
                decoder = new Base64Decoder(encoding);
                break;
            default:
                decoder = new GenericDecoder(encoding);
        }
        this.encoding = decoder.encoding;
        this.end = decoder.end;
        this.fillLast = decoder.fillLast;
        this.lastChar = decoder.lastChar;
        this.lastNeed = decoder.lastNeed;
        this.lastTotal = decoder.lastTotal;
        this.text = decoder.text;
        this.write = decoder.write;
    }
}
// Allow calling StringDecoder() without new
const PStringDecoder = new Proxy(StringDecoder, {
    apply (_target, thisArg, args) {
        // @ts-ignore tedious to replicate types ...
        return Object.assign(thisArg, new StringDecoder(...args));
    }
});
export default {
    StringDecoder: PStringDecoder
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvc3RyaW5nX2RlY29kZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi9idWZmZXIudHNcIjtcbmltcG9ydCB7IG5vcm1hbGl6ZUVuY29kaW5nIGFzIGNhc3RFbmNvZGluZywgbm90SW1wbGVtZW50ZWQgfSBmcm9tIFwiLi9fdXRpbHMudHNcIjtcblxuZW51bSBOb3RJbXBsZW1lbnRlZCB7XG4gIFwiYXNjaWlcIixcbiAgXCJsYXRpbjFcIixcbiAgXCJ1dGYxNmxlXCIsXG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUVuY29kaW5nKGVuYz86IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGVuY29kaW5nID0gY2FzdEVuY29kaW5nKGVuYyA/PyBudWxsKTtcbiAgaWYgKGVuY29kaW5nICYmIGVuY29kaW5nIGluIE5vdEltcGxlbWVudGVkKSBub3RJbXBsZW1lbnRlZChlbmNvZGluZyk7XG4gIGlmICghZW5jb2RpbmcgJiYgdHlwZW9mIGVuYyA9PT0gXCJzdHJpbmdcIiAmJiBlbmMudG9Mb3dlckNhc2UoKSAhPT0gXCJyYXdcIikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBlbmNvZGluZzogJHtlbmN9YCk7XG4gIH1cbiAgcmV0dXJuIFN0cmluZyhlbmNvZGluZyk7XG59XG5cbi8qKlxuICogQ2hlY2sgaXMgYEFycmF5QnVmZmVyYCBhbmQgbm90IGBUeXBlZEFycmF5YC4gVHlwZXNjcmlwdCBhbGxvd2VkIGBUeXBlZEFycmF5YCB0byBiZSBwYXNzZWQgYXMgYEFycmF5QnVmZmVyYCBhbmQgZG9lcyBub3QgZG8gYSBkZWVwIGNoZWNrXG4gKi9cblxuZnVuY3Rpb24gaXNCdWZmZXJUeXBlKGJ1ZjogQnVmZmVyKSB7XG4gIHJldHVybiBidWYgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciAmJiBidWYuQllURVNfUEVSX0VMRU1FTlQ7XG59XG5cbi8qXG4gKiBDaGVja3MgdGhlIHR5cGUgb2YgYSBVVEYtOCBieXRlLCB3aGV0aGVyIGl0J3MgQVNDSUksIGEgbGVhZGluZyBieXRlLCBvciBhXG4gKiBjb250aW51YXRpb24gYnl0ZS4gSWYgYW4gaW52YWxpZCBieXRlIGlzIGRldGVjdGVkLCAtMiBpcyByZXR1cm5lZC5cbiAqICovXG5mdW5jdGlvbiB1dGY4Q2hlY2tCeXRlKGJ5dGU6IG51bWJlcik6IG51bWJlciB7XG4gIGlmIChieXRlIDw9IDB4N2YpIHJldHVybiAwO1xuICBlbHNlIGlmIChieXRlID4+IDUgPT09IDB4MDYpIHJldHVybiAyO1xuICBlbHNlIGlmIChieXRlID4+IDQgPT09IDB4MGUpIHJldHVybiAzO1xuICBlbHNlIGlmIChieXRlID4+IDMgPT09IDB4MWUpIHJldHVybiA0O1xuICByZXR1cm4gYnl0ZSA+PiA2ID09PSAweDAyID8gLTEgOiAtMjtcbn1cblxuLypcbiAqIENoZWNrcyBhdCBtb3N0IDMgYnl0ZXMgYXQgdGhlIGVuZCBvZiBhIEJ1ZmZlciBpbiBvcmRlciB0byBkZXRlY3QgYW5cbiAqIGluY29tcGxldGUgbXVsdGktYnl0ZSBVVEYtOCBjaGFyYWN0ZXIuIFRoZSB0b3RhbCBudW1iZXIgb2YgYnl0ZXMgKDIsIDMsIG9yIDQpXG4gKiBuZWVkZWQgdG8gY29tcGxldGUgdGhlIFVURi04IGNoYXJhY3RlciAoaWYgYXBwbGljYWJsZSkgYXJlIHJldHVybmVkLlxuICogKi9cbmZ1bmN0aW9uIHV0ZjhDaGVja0luY29tcGxldGUoXG4gIHNlbGY6IFN0cmluZ0RlY29kZXJCYXNlLFxuICBidWY6IEJ1ZmZlcixcbiAgaTogbnVtYmVyLFxuKTogbnVtYmVyIHtcbiAgbGV0IGogPSBidWYubGVuZ3RoIC0gMTtcbiAgaWYgKGogPCBpKSByZXR1cm4gMDtcbiAgbGV0IG5iID0gdXRmOENoZWNrQnl0ZShidWZbal0pO1xuICBpZiAobmIgPj0gMCkge1xuICAgIGlmIChuYiA+IDApIHNlbGYubGFzdE5lZWQgPSBuYiAtIDE7XG4gICAgcmV0dXJuIG5iO1xuICB9XG4gIGlmICgtLWogPCBpIHx8IG5iID09PSAtMikgcmV0dXJuIDA7XG4gIG5iID0gdXRmOENoZWNrQnl0ZShidWZbal0pO1xuICBpZiAobmIgPj0gMCkge1xuICAgIGlmIChuYiA+IDApIHNlbGYubGFzdE5lZWQgPSBuYiAtIDI7XG4gICAgcmV0dXJuIG5iO1xuICB9XG4gIGlmICgtLWogPCBpIHx8IG5iID09PSAtMikgcmV0dXJuIDA7XG4gIG5iID0gdXRmOENoZWNrQnl0ZShidWZbal0pO1xuICBpZiAobmIgPj0gMCkge1xuICAgIGlmIChuYiA+IDApIHtcbiAgICAgIGlmIChuYiA9PT0gMikgbmIgPSAwO1xuICAgICAgZWxzZSBzZWxmLmxhc3ROZWVkID0gbmIgLSAzO1xuICAgIH1cbiAgICByZXR1cm4gbmI7XG4gIH1cbiAgcmV0dXJuIDA7XG59XG5cbi8qXG4gKiBWYWxpZGF0ZXMgYXMgbWFueSBjb250aW51YXRpb24gYnl0ZXMgZm9yIGEgbXVsdGktYnl0ZSBVVEYtOCBjaGFyYWN0ZXIgYXNcbiAqIG5lZWRlZCBvciBhcmUgYXZhaWxhYmxlLiBJZiB3ZSBzZWUgYSBub24tY29udGludWF0aW9uIGJ5dGUgd2hlcmUgd2UgZXhwZWN0XG4gKiBvbmUsIHdlIFwicmVwbGFjZVwiIHRoZSB2YWxpZGF0ZWQgY29udGludWF0aW9uIGJ5dGVzIHdlJ3ZlIHNlZW4gc28gZmFyIHdpdGhcbiAqIGEgc2luZ2xlIFVURi04IHJlcGxhY2VtZW50IGNoYXJhY3RlciAoJ1xcdWZmZmQnKSwgdG8gbWF0Y2ggdjgncyBVVEYtOCBkZWNvZGluZ1xuICogYmVoYXZpb3IuIFRoZSBjb250aW51YXRpb24gYnl0ZSBjaGVjayBpcyBpbmNsdWRlZCB0aHJlZSB0aW1lcyBpbiB0aGUgY2FzZVxuICogd2hlcmUgYWxsIG9mIHRoZSBjb250aW51YXRpb24gYnl0ZXMgZm9yIGEgY2hhcmFjdGVyIGV4aXN0IGluIHRoZSBzYW1lIGJ1ZmZlci5cbiAqIEl0IGlzIGFsc28gZG9uZSB0aGlzIHdheSBhcyBhIHNsaWdodCBwZXJmb3JtYW5jZSBpbmNyZWFzZSBpbnN0ZWFkIG9mIHVzaW5nIGFcbiAqIGxvb3AuXG4gKiAqL1xuZnVuY3Rpb24gdXRmOENoZWNrRXh0cmFCeXRlcyhcbiAgc2VsZjogU3RyaW5nRGVjb2RlckJhc2UsXG4gIGJ1ZjogQnVmZmVyLFxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKChidWZbMF0gJiAweGMwKSAhPT0gMHg4MCkge1xuICAgIHNlbGYubGFzdE5lZWQgPSAwO1xuICAgIHJldHVybiBcIlxcdWZmZmRcIjtcbiAgfVxuICBpZiAoc2VsZi5sYXN0TmVlZCA+IDEgJiYgYnVmLmxlbmd0aCA+IDEpIHtcbiAgICBpZiAoKGJ1ZlsxXSAmIDB4YzApICE9PSAweDgwKSB7XG4gICAgICBzZWxmLmxhc3ROZWVkID0gMTtcbiAgICAgIHJldHVybiBcIlxcdWZmZmRcIjtcbiAgICB9XG4gICAgaWYgKHNlbGYubGFzdE5lZWQgPiAyICYmIGJ1Zi5sZW5ndGggPiAyKSB7XG4gICAgICBpZiAoKGJ1ZlsyXSAmIDB4YzApICE9PSAweDgwKSB7XG4gICAgICAgIHNlbGYubGFzdE5lZWQgPSAyO1xuICAgICAgICByZXR1cm4gXCJcXHVmZmZkXCI7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qXG4gKiBBdHRlbXB0cyB0byBjb21wbGV0ZSBhIG11bHRpLWJ5dGUgVVRGLTggY2hhcmFjdGVyIHVzaW5nIGJ5dGVzIGZyb20gYSBCdWZmZXIuXG4gKiAqL1xuZnVuY3Rpb24gdXRmOEZpbGxMYXN0Q29tcGxldGUoXG4gIHRoaXM6IFN0cmluZ0RlY29kZXJCYXNlLFxuICBidWY6IEJ1ZmZlcixcbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHAgPSB0aGlzLmxhc3RUb3RhbCAtIHRoaXMubGFzdE5lZWQ7XG4gIGNvbnN0IHIgPSB1dGY4Q2hlY2tFeHRyYUJ5dGVzKHRoaXMsIGJ1Zik7XG4gIGlmIChyICE9PSB1bmRlZmluZWQpIHJldHVybiByO1xuICBpZiAodGhpcy5sYXN0TmVlZCA8PSBidWYubGVuZ3RoKSB7XG4gICAgYnVmLmNvcHkodGhpcy5sYXN0Q2hhciwgcCwgMCwgdGhpcy5sYXN0TmVlZCk7XG4gICAgcmV0dXJuIHRoaXMubGFzdENoYXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgdGhpcy5sYXN0VG90YWwpO1xuICB9XG4gIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIHAsIDAsIGJ1Zi5sZW5ndGgpO1xuICB0aGlzLmxhc3ROZWVkIC09IGJ1Zi5sZW5ndGg7XG59XG5cbi8qXG4gKiBBdHRlbXB0cyB0byBjb21wbGV0ZSBhIHBhcnRpYWwgbm9uLVVURi04IGNoYXJhY3RlciB1c2luZyBieXRlcyBmcm9tIGEgQnVmZmVyXG4gKiAqL1xuZnVuY3Rpb24gdXRmOEZpbGxMYXN0SW5jb21wbGV0ZShcbiAgdGhpczogU3RyaW5nRGVjb2RlckJhc2UsXG4gIGJ1ZjogQnVmZmVyLFxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHRoaXMubGFzdE5lZWQgPD0gYnVmLmxlbmd0aCkge1xuICAgIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIHRoaXMubGFzdFRvdGFsIC0gdGhpcy5sYXN0TmVlZCwgMCwgdGhpcy5sYXN0TmVlZCk7XG4gICAgcmV0dXJuIHRoaXMubGFzdENoYXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgdGhpcy5sYXN0VG90YWwpO1xuICB9XG4gIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIHRoaXMubGFzdFRvdGFsIC0gdGhpcy5sYXN0TmVlZCwgMCwgYnVmLmxlbmd0aCk7XG4gIHRoaXMubGFzdE5lZWQgLT0gYnVmLmxlbmd0aDtcbn1cblxuLypcbiAqIFJldHVybnMgYWxsIGNvbXBsZXRlIFVURi04IGNoYXJhY3RlcnMgaW4gYSBCdWZmZXIuIElmIHRoZSBCdWZmZXIgZW5kZWQgb24gYVxuICogcGFydGlhbCBjaGFyYWN0ZXIsIHRoZSBjaGFyYWN0ZXIncyBieXRlcyBhcmUgYnVmZmVyZWQgdW50aWwgdGhlIHJlcXVpcmVkXG4gKiBudW1iZXIgb2YgYnl0ZXMgYXJlIGF2YWlsYWJsZS5cbiAqICovXG5mdW5jdGlvbiB1dGY4VGV4dCh0aGlzOiBTdHJpbmdEZWNvZGVyQmFzZSwgYnVmOiBCdWZmZXIsIGk6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsID0gdXRmOENoZWNrSW5jb21wbGV0ZSh0aGlzLCBidWYsIGkpO1xuICBpZiAoIXRoaXMubGFzdE5lZWQpIHJldHVybiBidWYudG9TdHJpbmcoXCJ1dGY4XCIsIGkpO1xuICB0aGlzLmxhc3RUb3RhbCA9IHRvdGFsO1xuICBjb25zdCBlbmQgPSBidWYubGVuZ3RoIC0gKHRvdGFsIC0gdGhpcy5sYXN0TmVlZCk7XG4gIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIDAsIGVuZCk7XG4gIHJldHVybiBidWYudG9TdHJpbmcoXCJ1dGY4XCIsIGksIGVuZCk7XG59XG5cbi8qXG4gKiBGb3IgVVRGLTgsIGEgcmVwbGFjZW1lbnQgY2hhcmFjdGVyIGlzIGFkZGVkIHdoZW4gZW5kaW5nIG9uIGEgcGFydGlhbFxuICogY2hhcmFjdGVyLlxuICogKi9cbmZ1bmN0aW9uIHV0ZjhFbmQodGhpczogVXRmOERlY29kZXIsIGJ1Zj86IEJ1ZmZlcik6IHN0cmluZyB7XG4gIGNvbnN0IHIgPSBidWYgJiYgYnVmLmxlbmd0aCA/IHRoaXMud3JpdGUoYnVmKSA6IFwiXCI7XG4gIGlmICh0aGlzLmxhc3ROZWVkKSByZXR1cm4gciArIFwiXFx1ZmZmZFwiO1xuICByZXR1cm4gcjtcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlKFxuICB0aGlzOiBVdGY4RGVjb2RlciB8IEJhc2U2NERlY29kZXIsXG4gIGJ1ZjogQnVmZmVyIHwgc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBidWYgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gYnVmO1xuICB9XG4gIGlmIChidWYubGVuZ3RoID09PSAwKSByZXR1cm4gXCJcIjtcbiAgbGV0IHI7XG4gIGxldCBpO1xuICAvLyBCZWNhdXNlIGBUeXBlZEFycmF5YCBpcyByZWNvZ25pemVkIGFzIGBBcnJheUJ1ZmZlcmAgYnV0IGluIHRoZSByZWFsaXR5LCB0aGVyZSBhcmUgc29tZSBmdW5kYW1lbnRhbCBkaWZmZXJlbmNlLiBXZSB3b3VsZCBuZWVkIHRvIGNhc3QgaXQgcHJvcGVybHlcbiAgY29uc3Qgbm9ybWFsaXplZEJ1ZmZlcjogQnVmZmVyID0gaXNCdWZmZXJUeXBlKGJ1ZikgPyBidWYgOiBCdWZmZXIuZnJvbShidWYpO1xuICBpZiAodGhpcy5sYXN0TmVlZCkge1xuICAgIHIgPSB0aGlzLmZpbGxMYXN0KG5vcm1hbGl6ZWRCdWZmZXIpO1xuICAgIGlmIChyID09PSB1bmRlZmluZWQpIHJldHVybiBcIlwiO1xuICAgIGkgPSB0aGlzLmxhc3ROZWVkO1xuICAgIHRoaXMubGFzdE5lZWQgPSAwO1xuICB9IGVsc2Uge1xuICAgIGkgPSAwO1xuICB9XG4gIGlmIChpIDwgYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiByXG4gICAgICA/IHIgKyB0aGlzLnRleHQobm9ybWFsaXplZEJ1ZmZlciwgaSlcbiAgICAgIDogdGhpcy50ZXh0KG5vcm1hbGl6ZWRCdWZmZXIsIGkpO1xuICB9XG4gIHJldHVybiByIHx8IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRleHQodGhpczogU3RyaW5nRGVjb2RlckJhc2UsIGJ1ZjogQnVmZmVyLCBpOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBuID0gKGJ1Zi5sZW5ndGggLSBpKSAlIDM7XG4gIGlmIChuID09PSAwKSByZXR1cm4gYnVmLnRvU3RyaW5nKFwiYmFzZTY0XCIsIGkpO1xuICB0aGlzLmxhc3ROZWVkID0gMyAtIG47XG4gIHRoaXMubGFzdFRvdGFsID0gMztcbiAgaWYgKG4gPT09IDEpIHtcbiAgICB0aGlzLmxhc3RDaGFyWzBdID0gYnVmW2J1Zi5sZW5ndGggLSAxXTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmxhc3RDaGFyWzBdID0gYnVmW2J1Zi5sZW5ndGggLSAyXTtcbiAgICB0aGlzLmxhc3RDaGFyWzFdID0gYnVmW2J1Zi5sZW5ndGggLSAxXTtcbiAgfVxuICByZXR1cm4gYnVmLnRvU3RyaW5nKFwiYmFzZTY0XCIsIGksIGJ1Zi5sZW5ndGggLSBuKTtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RW5kKHRoaXM6IEJhc2U2NERlY29kZXIsIGJ1Zj86IEJ1ZmZlcik6IHN0cmluZyB7XG4gIGNvbnN0IHIgPSBidWYgJiYgYnVmLmxlbmd0aCA/IHRoaXMud3JpdGUoYnVmKSA6IFwiXCI7XG4gIGlmICh0aGlzLmxhc3ROZWVkKSB7XG4gICAgcmV0dXJuIHIgKyB0aGlzLmxhc3RDaGFyLnRvU3RyaW5nKFwiYmFzZTY0XCIsIDAsIDMgLSB0aGlzLmxhc3ROZWVkKTtcbiAgfVxuICByZXR1cm4gcjtcbn1cblxuZnVuY3Rpb24gc2ltcGxlV3JpdGUoXG4gIHRoaXM6IFN0cmluZ0RlY29kZXJCYXNlLFxuICBidWY6IEJ1ZmZlciB8IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgYnVmID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGJ1ZjtcbiAgfVxuICByZXR1cm4gYnVmLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpO1xufVxuXG5mdW5jdGlvbiBzaW1wbGVFbmQodGhpczogR2VuZXJpY0RlY29kZXIsIGJ1Zj86IEJ1ZmZlcik6IHN0cmluZyB7XG4gIHJldHVybiBidWYgJiYgYnVmLmxlbmd0aCA/IHRoaXMud3JpdGUoYnVmKSA6IFwiXCI7XG59XG5cbmNsYXNzIFN0cmluZ0RlY29kZXJCYXNlIHtcbiAgcHVibGljIGxhc3RDaGFyOiBCdWZmZXI7XG4gIHB1YmxpYyBsYXN0TmVlZCA9IDA7XG4gIHB1YmxpYyBsYXN0VG90YWwgPSAwO1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZW5jb2Rpbmc6IHN0cmluZywgbmI6IG51bWJlcikge1xuICAgIHRoaXMubGFzdENoYXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobmIpO1xuICB9XG59XG5cbmNsYXNzIEJhc2U2NERlY29kZXIgZXh0ZW5kcyBTdHJpbmdEZWNvZGVyQmFzZSB7XG4gIHB1YmxpYyBlbmQgPSBiYXNlNjRFbmQ7XG4gIHB1YmxpYyBmaWxsTGFzdCA9IHV0ZjhGaWxsTGFzdEluY29tcGxldGU7XG4gIHB1YmxpYyB0ZXh0ID0gYmFzZTY0VGV4dDtcbiAgcHVibGljIHdyaXRlID0gdXRmOFdyaXRlO1xuXG4gIGNvbnN0cnVjdG9yKGVuY29kaW5nPzogc3RyaW5nKSB7XG4gICAgc3VwZXIobm9ybWFsaXplRW5jb2RpbmcoZW5jb2RpbmcpLCAzKTtcbiAgfVxufVxuXG5jbGFzcyBHZW5lcmljRGVjb2RlciBleHRlbmRzIFN0cmluZ0RlY29kZXJCYXNlIHtcbiAgcHVibGljIGVuZCA9IHNpbXBsZUVuZDtcbiAgcHVibGljIGZpbGxMYXN0ID0gdW5kZWZpbmVkO1xuICBwdWJsaWMgdGV4dCA9IHV0ZjhUZXh0O1xuICBwdWJsaWMgd3JpdGUgPSBzaW1wbGVXcml0ZTtcblxuICBjb25zdHJ1Y3RvcihlbmNvZGluZz86IHN0cmluZykge1xuICAgIHN1cGVyKG5vcm1hbGl6ZUVuY29kaW5nKGVuY29kaW5nKSwgNCk7XG4gIH1cbn1cblxuY2xhc3MgVXRmOERlY29kZXIgZXh0ZW5kcyBTdHJpbmdEZWNvZGVyQmFzZSB7XG4gIHB1YmxpYyBlbmQgPSB1dGY4RW5kO1xuICBwdWJsaWMgZmlsbExhc3QgPSB1dGY4RmlsbExhc3RDb21wbGV0ZTtcbiAgcHVibGljIHRleHQgPSB1dGY4VGV4dDtcbiAgcHVibGljIHdyaXRlID0gdXRmOFdyaXRlO1xuXG4gIGNvbnN0cnVjdG9yKGVuY29kaW5nPzogc3RyaW5nKSB7XG4gICAgc3VwZXIobm9ybWFsaXplRW5jb2RpbmcoZW5jb2RpbmcpLCA0KTtcbiAgfVxufVxuXG4vKlxuICogU3RyaW5nRGVjb2RlciBwcm92aWRlcyBhbiBpbnRlcmZhY2UgZm9yIGVmZmljaWVudGx5IHNwbGl0dGluZyBhIHNlcmllcyBvZlxuICogYnVmZmVycyBpbnRvIGEgc2VyaWVzIG9mIEpTIHN0cmluZ3Mgd2l0aG91dCBicmVha2luZyBhcGFydCBtdWx0aS1ieXRlXG4gKiBjaGFyYWN0ZXJzLlxuICogKi9cbmV4cG9ydCBjbGFzcyBTdHJpbmdEZWNvZGVyIHtcbiAgcHVibGljIGVuY29kaW5nOiBzdHJpbmc7XG4gIHB1YmxpYyBlbmQ6IChidWY/OiBCdWZmZXIpID0+IHN0cmluZztcbiAgcHVibGljIGZpbGxMYXN0OiAoKGJ1ZjogQnVmZmVyKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQpIHwgdW5kZWZpbmVkO1xuICBwdWJsaWMgbGFzdENoYXI6IEJ1ZmZlcjtcbiAgcHVibGljIGxhc3ROZWVkOiBudW1iZXI7XG4gIHB1YmxpYyBsYXN0VG90YWw6IG51bWJlcjtcbiAgcHVibGljIHRleHQ6IChidWY6IEJ1ZmZlciwgbjogbnVtYmVyKSA9PiBzdHJpbmc7XG4gIHB1YmxpYyB3cml0ZTogKGJ1ZjogQnVmZmVyKSA9PiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoZW5jb2Rpbmc/OiBzdHJpbmcpIHtcbiAgICBjb25zdCBub3JtYWxpemVkRW5jb2RpbmcgPSBub3JtYWxpemVFbmNvZGluZyhlbmNvZGluZyk7XG4gICAgbGV0IGRlY29kZXI6IFV0ZjhEZWNvZGVyIHwgQmFzZTY0RGVjb2RlciB8IEdlbmVyaWNEZWNvZGVyO1xuICAgIHN3aXRjaCAobm9ybWFsaXplZEVuY29kaW5nKSB7XG4gICAgICBjYXNlIFwidXRmOFwiOlxuICAgICAgICBkZWNvZGVyID0gbmV3IFV0ZjhEZWNvZGVyKGVuY29kaW5nKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiYmFzZTY0XCI6XG4gICAgICAgIGRlY29kZXIgPSBuZXcgQmFzZTY0RGVjb2RlcihlbmNvZGluZyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgZGVjb2RlciA9IG5ldyBHZW5lcmljRGVjb2RlcihlbmNvZGluZyk7XG4gICAgfVxuICAgIHRoaXMuZW5jb2RpbmcgPSBkZWNvZGVyLmVuY29kaW5nO1xuICAgIHRoaXMuZW5kID0gZGVjb2Rlci5lbmQ7XG4gICAgdGhpcy5maWxsTGFzdCA9IGRlY29kZXIuZmlsbExhc3Q7XG4gICAgdGhpcy5sYXN0Q2hhciA9IGRlY29kZXIubGFzdENoYXI7XG4gICAgdGhpcy5sYXN0TmVlZCA9IGRlY29kZXIubGFzdE5lZWQ7XG4gICAgdGhpcy5sYXN0VG90YWwgPSBkZWNvZGVyLmxhc3RUb3RhbDtcbiAgICB0aGlzLnRleHQgPSBkZWNvZGVyLnRleHQ7XG4gICAgdGhpcy53cml0ZSA9IGRlY29kZXIud3JpdGU7XG4gIH1cbn1cbi8vIEFsbG93IGNhbGxpbmcgU3RyaW5nRGVjb2RlcigpIHdpdGhvdXQgbmV3XG5jb25zdCBQU3RyaW5nRGVjb2RlciA9IG5ldyBQcm94eShTdHJpbmdEZWNvZGVyLCB7XG4gIGFwcGx5KF90YXJnZXQsIHRoaXNBcmcsIGFyZ3MpIHtcbiAgICAvLyBAdHMtaWdub3JlIHRlZGlvdXMgdG8gcmVwbGljYXRlIHR5cGVzIC4uLlxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHRoaXNBcmcsIG5ldyBTdHJpbmdEZWNvZGVyKC4uLmFyZ3MpKTtcbiAgfSxcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCB7IFN0cmluZ0RlY29kZXI6IFBTdHJpbmdEZWNvZGVyIH07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNEQUFzRDtBQUN0RCxFQUFFO0FBQ0YsMEVBQTBFO0FBQzFFLGdFQUFnRTtBQUNoRSxzRUFBc0U7QUFDdEUsc0VBQXNFO0FBQ3RFLDRFQUE0RTtBQUM1RSxxRUFBcUU7QUFDckUsd0JBQXdCO0FBQ3hCLEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUseURBQXlEO0FBQ3pELEVBQUU7QUFDRiwwRUFBMEU7QUFDMUUsNkRBQTZEO0FBQzdELDRFQUE0RTtBQUM1RSwyRUFBMkU7QUFDM0Usd0VBQXdFO0FBQ3hFLDRFQUE0RTtBQUM1RSx5Q0FBeUM7QUFFekMsU0FBUyxNQUFNLFFBQVEsY0FBYztBQUNyQyxTQUFTLHFCQUFxQixZQUFZLEVBQUUsY0FBYyxRQUFRLGNBQWM7SUFFaEY7VUFBSyxjQUFjO0lBQWQsZUFBQSxlQUNILFdBQUEsS0FBQTtJQURHLGVBQUEsZUFFSCxZQUFBLEtBQUE7SUFGRyxlQUFBLGVBR0gsYUFBQSxLQUFBO0dBSEcsbUJBQUE7QUFNTCxTQUFTLGtCQUFrQixHQUFZLEVBQVU7SUFDL0MsTUFBTSxXQUFXLGFBQWEsT0FBTyxJQUFJO0lBQ3pDLElBQUksWUFBWSxZQUFZLGdCQUFnQixlQUFlO0lBQzNELElBQUksQ0FBQyxZQUFZLE9BQU8sUUFBUSxZQUFZLElBQUksV0FBVyxPQUFPLE9BQU87UUFDdkUsTUFBTSxJQUFJLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsRUFBRTtJQUM5QyxDQUFDO0lBQ0QsT0FBTyxPQUFPO0FBQ2hCO0FBRUE7O0NBRUMsR0FFRCxTQUFTLGFBQWEsR0FBVyxFQUFFO0lBQ2pDLE9BQU8sZUFBZSxlQUFlLElBQUksaUJBQWlCO0FBQzVEO0FBRUE7OztHQUdHLEdBQ0gsU0FBUyxjQUFjLElBQVksRUFBVTtJQUMzQyxJQUFJLFFBQVEsTUFBTSxPQUFPO1NBQ3BCLElBQUksUUFBUSxNQUFNLE1BQU0sT0FBTztTQUMvQixJQUFJLFFBQVEsTUFBTSxNQUFNLE9BQU87U0FDL0IsSUFBSSxRQUFRLE1BQU0sTUFBTSxPQUFPO0lBQ3BDLE9BQU8sUUFBUSxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQztBQUVBOzs7O0dBSUcsR0FDSCxTQUFTLG9CQUNQLElBQXVCLEVBQ3ZCLEdBQVcsRUFDWCxDQUFTLEVBQ0Q7SUFDUixJQUFJLElBQUksSUFBSSxNQUFNLEdBQUc7SUFDckIsSUFBSSxJQUFJLEdBQUcsT0FBTztJQUNsQixJQUFJLEtBQUssY0FBYyxHQUFHLENBQUMsRUFBRTtJQUM3QixJQUFJLE1BQU0sR0FBRztRQUNYLElBQUksS0FBSyxHQUFHLEtBQUssUUFBUSxHQUFHLEtBQUs7UUFDakMsT0FBTztJQUNULENBQUM7SUFDRCxJQUFJLEVBQUUsSUFBSSxLQUFLLE9BQU8sQ0FBQyxHQUFHLE9BQU87SUFDakMsS0FBSyxjQUFjLEdBQUcsQ0FBQyxFQUFFO0lBQ3pCLElBQUksTUFBTSxHQUFHO1FBQ1gsSUFBSSxLQUFLLEdBQUcsS0FBSyxRQUFRLEdBQUcsS0FBSztRQUNqQyxPQUFPO0lBQ1QsQ0FBQztJQUNELElBQUksRUFBRSxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsT0FBTztJQUNqQyxLQUFLLGNBQWMsR0FBRyxDQUFDLEVBQUU7SUFDekIsSUFBSSxNQUFNLEdBQUc7UUFDWCxJQUFJLEtBQUssR0FBRztZQUNWLElBQUksT0FBTyxHQUFHLEtBQUs7aUJBQ2QsS0FBSyxRQUFRLEdBQUcsS0FBSztRQUM1QixDQUFDO1FBQ0QsT0FBTztJQUNULENBQUM7SUFDRCxPQUFPO0FBQ1Q7QUFFQTs7Ozs7Ozs7O0dBU0csR0FDSCxTQUFTLG9CQUNQLElBQXVCLEVBQ3ZCLEdBQVcsRUFDUztJQUNwQixJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxJQUFJLE1BQU0sTUFBTTtRQUM1QixLQUFLLFFBQVEsR0FBRztRQUNoQixPQUFPO0lBQ1QsQ0FBQztJQUNELElBQUksS0FBSyxRQUFRLEdBQUcsS0FBSyxJQUFJLE1BQU0sR0FBRyxHQUFHO1FBQ3ZDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLElBQUksTUFBTSxNQUFNO1lBQzVCLEtBQUssUUFBUSxHQUFHO1lBQ2hCLE9BQU87UUFDVCxDQUFDO1FBQ0QsSUFBSSxLQUFLLFFBQVEsR0FBRyxLQUFLLElBQUksTUFBTSxHQUFHLEdBQUc7WUFDdkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsSUFBSSxNQUFNLE1BQU07Z0JBQzVCLEtBQUssUUFBUSxHQUFHO2dCQUNoQixPQUFPO1lBQ1QsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0FBQ0g7QUFFQTs7R0FFRyxHQUNILFNBQVMscUJBRVAsR0FBVyxFQUNTO0lBQ3BCLE1BQU0sSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRO0lBQ3hDLE1BQU0sSUFBSSxvQkFBb0IsSUFBSSxFQUFFO0lBQ3BDLElBQUksTUFBTSxXQUFXLE9BQU87SUFDNUIsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksTUFBTSxFQUFFO1FBQy9CLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRO1FBQzNDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTO0lBQ2hFLENBQUM7SUFDRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEdBQUcsR0FBRyxJQUFJLE1BQU07SUFDeEMsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLE1BQU07QUFDN0I7QUFFQTs7R0FFRyxHQUNILFNBQVMsdUJBRVAsR0FBVyxFQUNTO0lBQ3BCLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLE1BQU0sRUFBRTtRQUMvQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRO1FBQ3hFLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTO0lBQ2hFLENBQUM7SUFDRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUksTUFBTTtJQUNyRSxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksTUFBTTtBQUM3QjtBQUVBOzs7O0dBSUcsR0FDSCxTQUFTLFNBQWtDLEdBQVcsRUFBRSxDQUFTLEVBQVU7SUFDekUsTUFBTSxRQUFRLG9CQUFvQixJQUFJLEVBQUUsS0FBSztJQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLElBQUksUUFBUSxDQUFDLFFBQVE7SUFDaEQsSUFBSSxDQUFDLFNBQVMsR0FBRztJQUNqQixNQUFNLE1BQU0sSUFBSSxNQUFNLEdBQUcsQ0FBQyxRQUFRLElBQUksQ0FBQyxRQUFRO0lBQy9DLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsR0FBRztJQUMzQixPQUFPLElBQUksUUFBUSxDQUFDLFFBQVEsR0FBRztBQUNqQztBQUVBOzs7R0FHRyxHQUNILFNBQVMsUUFBMkIsR0FBWSxFQUFVO0lBQ3hELE1BQU0sSUFBSSxPQUFPLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO0lBQ2xELElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLElBQUk7SUFDOUIsT0FBTztBQUNUO0FBRUEsU0FBUyxVQUVQLEdBQW9CLEVBQ1o7SUFDUixJQUFJLE9BQU8sUUFBUSxVQUFVO1FBQzNCLE9BQU87SUFDVCxDQUFDO0lBQ0QsSUFBSSxJQUFJLE1BQU0sS0FBSyxHQUFHLE9BQU87SUFDN0IsSUFBSTtJQUNKLElBQUk7SUFDSixtSkFBbUo7SUFDbkosTUFBTSxtQkFBMkIsYUFBYSxPQUFPLE1BQU0sT0FBTyxJQUFJLENBQUMsSUFBSTtJQUMzRSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7UUFDakIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ2xCLElBQUksTUFBTSxXQUFXLE9BQU87UUFDNUIsSUFBSSxJQUFJLENBQUMsUUFBUTtRQUNqQixJQUFJLENBQUMsUUFBUSxHQUFHO0lBQ2xCLE9BQU87UUFDTCxJQUFJO0lBQ04sQ0FBQztJQUNELElBQUksSUFBSSxJQUFJLE1BQU0sRUFBRTtRQUNsQixPQUFPLElBQ0gsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixLQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFO0lBQ3BDLENBQUM7SUFDRCxPQUFPLEtBQUs7QUFDZDtBQUVBLFNBQVMsV0FBb0MsR0FBVyxFQUFFLENBQVMsRUFBVTtJQUMzRSxNQUFNLElBQUksQ0FBQyxJQUFJLE1BQU0sR0FBRyxDQUFDLElBQUk7SUFDN0IsSUFBSSxNQUFNLEdBQUcsT0FBTyxJQUFJLFFBQVEsQ0FBQyxVQUFVO0lBQzNDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSTtJQUNwQixJQUFJLENBQUMsU0FBUyxHQUFHO0lBQ2pCLElBQUksTUFBTSxHQUFHO1FBQ1gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksTUFBTSxHQUFHLEVBQUU7SUFDeEMsT0FBTztRQUNMLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxFQUFFO1FBQ3RDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxFQUFFO0lBQ3hDLENBQUM7SUFDRCxPQUFPLElBQUksUUFBUSxDQUFDLFVBQVUsR0FBRyxJQUFJLE1BQU0sR0FBRztBQUNoRDtBQUVBLFNBQVMsVUFBK0IsR0FBWSxFQUFVO0lBQzVELE1BQU0sSUFBSSxPQUFPLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO0lBQ2xELElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUNqQixPQUFPLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVE7SUFDbEUsQ0FBQztJQUNELE9BQU87QUFDVDtBQUVBLFNBQVMsWUFFUCxHQUFvQixFQUNaO0lBQ1IsSUFBSSxPQUFPLFFBQVEsVUFBVTtRQUMzQixPQUFPO0lBQ1QsQ0FBQztJQUNELE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVE7QUFDbkM7QUFFQSxTQUFTLFVBQWdDLEdBQVksRUFBVTtJQUM3RCxPQUFPLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUU7QUFDakQ7QUFFQSxNQUFNO0lBQ0csU0FBaUI7SUFDakIsU0FBYTtJQUNiLFVBQWM7SUFDckIsWUFBbUIsVUFBa0IsRUFBVSxDQUFFO3dCQUE5QjthQUZaLFdBQVc7YUFDWCxZQUFZO1FBRWpCLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxXQUFXLENBQUM7SUFDckM7SUFGbUI7QUFHckI7QUFFQSxNQUFNLHNCQUFzQjtJQUNuQixNQUFNLFVBQVU7SUFDaEIsV0FBVyx1QkFBdUI7SUFDbEMsT0FBTyxXQUFXO0lBQ2xCLFFBQVEsVUFBVTtJQUV6QixZQUFZLFFBQWlCLENBQUU7UUFDN0IsS0FBSyxDQUFDLGtCQUFrQixXQUFXO0lBQ3JDO0FBQ0Y7QUFFQSxNQUFNLHVCQUF1QjtJQUNwQixNQUFNLFVBQVU7SUFDaEIsV0FBVyxVQUFVO0lBQ3JCLE9BQU8sU0FBUztJQUNoQixRQUFRLFlBQVk7SUFFM0IsWUFBWSxRQUFpQixDQUFFO1FBQzdCLEtBQUssQ0FBQyxrQkFBa0IsV0FBVztJQUNyQztBQUNGO0FBRUEsTUFBTSxvQkFBb0I7SUFDakIsTUFBTSxRQUFRO0lBQ2QsV0FBVyxxQkFBcUI7SUFDaEMsT0FBTyxTQUFTO0lBQ2hCLFFBQVEsVUFBVTtJQUV6QixZQUFZLFFBQWlCLENBQUU7UUFDN0IsS0FBSyxDQUFDLGtCQUFrQixXQUFXO0lBQ3JDO0FBQ0Y7QUFFQTs7OztHQUlHLEdBQ0gsT0FBTyxNQUFNO0lBQ0osU0FBaUI7SUFDakIsSUFBOEI7SUFDOUIsU0FBNEQ7SUFDNUQsU0FBaUI7SUFDakIsU0FBaUI7SUFDakIsVUFBa0I7SUFDbEIsS0FBeUM7SUFDekMsTUFBK0I7SUFFdEMsWUFBWSxRQUFpQixDQUFFO1FBQzdCLE1BQU0scUJBQXFCLGtCQUFrQjtRQUM3QyxJQUFJO1FBQ0osT0FBUTtZQUNOLEtBQUs7Z0JBQ0gsVUFBVSxJQUFJLFlBQVk7Z0JBQzFCLEtBQU07WUFDUixLQUFLO2dCQUNILFVBQVUsSUFBSSxjQUFjO2dCQUM1QixLQUFNO1lBQ1I7Z0JBQ0UsVUFBVSxJQUFJLGVBQWU7UUFDakM7UUFDQSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsUUFBUTtRQUNoQyxJQUFJLENBQUMsR0FBRyxHQUFHLFFBQVEsR0FBRztRQUN0QixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsUUFBUTtRQUNoQyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsUUFBUTtRQUNoQyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsUUFBUTtRQUNoQyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsU0FBUztRQUNsQyxJQUFJLENBQUMsSUFBSSxHQUFHLFFBQVEsSUFBSTtRQUN4QixJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsS0FBSztJQUM1QjtBQUNGLENBQUM7QUFDRCw0Q0FBNEM7QUFDNUMsTUFBTSxpQkFBaUIsSUFBSSxNQUFNLGVBQWU7SUFDOUMsT0FBTSxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTtRQUM1Qiw0Q0FBNEM7UUFDNUMsT0FBTyxPQUFPLE1BQU0sQ0FBQyxTQUFTLElBQUksaUJBQWlCO0lBQ3JEO0FBQ0Y7QUFFQSxlQUFlO0lBQUUsZUFBZTtBQUFlLEVBQUUifQ==