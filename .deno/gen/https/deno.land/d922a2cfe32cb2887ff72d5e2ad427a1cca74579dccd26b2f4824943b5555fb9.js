// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import _http_agent from "./_http_agent.mjs";
import _http_outgoing from "./_http_outgoing.ts";
import _stream_duplex from "./internal/streams/duplex.mjs";
import _stream_passthrough from "./internal/streams/passthrough.mjs";
import _stream_readable from "./internal/streams/readable.mjs";
import _stream_transform from "./internal/streams/transform.mjs";
import _stream_writable from "./internal/streams/writable.mjs";
import assert from "./assert.ts";
import assertStrict from "./assert/strict.ts";
import async_hooks from "./async_hooks.ts";
import buffer from "./buffer.ts";
import childProcess from "./child_process.ts";
import cluster from "./cluster.ts";
import console from "./console.ts";
import constants from "./constants.ts";
import crypto from "./crypto.ts";
import dgram from "./dgram.ts";
import diagnosticsChannel from "./diagnostics_channel.ts";
import dns from "./dns.ts";
import dnsPromises from "./dns/promises.ts";
import domain from "./domain.ts";
import events from "./events.ts";
import fs from "./fs.ts";
import fsPromises from "./fs/promises.ts";
import http from "./http.ts";
import http2 from "./http2.ts";
import https from "./https.ts";
import inspector from "./inspector.ts";
import internalCp from "./internal/child_process.ts";
import internalCryptoCertificate from "./internal/crypto/certificate.ts";
import internalCryptoCipher from "./internal/crypto/cipher.ts";
import internalCryptoDiffiehellman from "./internal/crypto/diffiehellman.ts";
import internalCryptoHash from "./internal/crypto/hash.ts";
import internalCryptoHkdf from "./internal/crypto/hkdf.ts";
import internalCryptoKeygen from "./internal/crypto/keygen.ts";
import internalCryptoKeys from "./internal/crypto/keys.ts";
import internalCryptoPbkdf2 from "./internal/crypto/pbkdf2.ts";
import internalCryptoRandom from "./internal/crypto/random.ts";
import internalCryptoScrypt from "./internal/crypto/scrypt.ts";
import internalCryptoSig from "./internal/crypto/sig.ts";
import internalCryptoUtil from "./internal/crypto/util.ts";
import internalCryptoX509 from "./internal/crypto/x509.ts";
import internalDgram from "./internal/dgram.ts";
import internalDnsPromises from "./internal/dns/promises.ts";
import internalErrors from "./internal/errors.ts";
import internalEventTarget from "./internal/event_target.mjs";
import internalFsUtils from "./internal/fs/utils.mjs";
import internalHttp from "./internal/http.ts";
import internalReadlineUtils from "./internal/readline/utils.mjs";
import internalStreamsAddAbortSignal from "./internal/streams/add-abort-signal.mjs";
import internalStreamsBufferList from "./internal/streams/buffer_list.mjs";
import internalStreamsLazyTransform from "./internal/streams/lazy_transform.mjs";
import internalStreamsState from "./internal/streams/state.mjs";
import internalTestBinding from "./internal/test/binding.ts";
import internalTimers from "./internal/timers.mjs";
import internalUtil from "./internal/util.mjs";
import internalUtilInspect from "./internal/util/inspect.mjs";
import net from "./net.ts";
import os from "./os.ts";
import pathPosix from "./path/posix.ts";
import pathWin32 from "./path/win32.ts";
import path from "./path.ts";
import perfHooks from "./perf_hooks.ts";
import punycode from "./punycode.ts";
import process from "./process.ts";
import querystring from "./querystring.ts";
import readline from "./readline.ts";
import readlinePromises from "./readline/promises.ts";
import repl from "./repl.ts";
import stream from "./stream.ts";
import streamConsumers from "./stream/consumers.mjs";
import streamPromises from "./stream/promises.mjs";
import streamWeb from "./stream/web.ts";
import stringDecoder from "./string_decoder.ts";
import sys from "./sys.ts";
import timers from "./timers.ts";
import timersPromises from "./timers/promises.ts";
import tls from "./tls.ts";
import tty from "./tty.ts";
import url from "./url.ts";
import utilTypes from "./util/types.ts";
import util from "./util.ts";
import v8 from "./v8.ts";
import vm from "./vm.ts";
import workerThreads from "./worker_threads.ts";
import wasi from "./wasi.ts";
import zlib from "./zlib.ts";
// Canonical mapping of supported modules
export default {
    _http_agent,
    _http_outgoing,
    _stream_duplex,
    _stream_passthrough,
    _stream_readable,
    _stream_transform,
    _stream_writable,
    assert,
    "assert/strict": assertStrict,
    async_hooks,
    buffer,
    crypto,
    console,
    constants,
    child_process: childProcess,
    cluster,
    dgram,
    diagnostics_channel: diagnosticsChannel,
    dns,
    "dns/promises": dnsPromises,
    domain,
    events,
    fs,
    "fs/promises": fsPromises,
    http,
    http2,
    https,
    inspector,
    "internal/child_process": internalCp,
    "internal/crypto/certificate": internalCryptoCertificate,
    "internal/crypto/cipher": internalCryptoCipher,
    "internal/crypto/diffiehellman": internalCryptoDiffiehellman,
    "internal/crypto/hash": internalCryptoHash,
    "internal/crypto/hkdf": internalCryptoHkdf,
    "internal/crypto/keygen": internalCryptoKeygen,
    "internal/crypto/keys": internalCryptoKeys,
    "internal/crypto/pbkdf2": internalCryptoPbkdf2,
    "internal/crypto/random": internalCryptoRandom,
    "internal/crypto/scrypt": internalCryptoScrypt,
    "internal/crypto/sig": internalCryptoSig,
    "internal/crypto/util": internalCryptoUtil,
    "internal/crypto/x509": internalCryptoX509,
    "internal/dgram": internalDgram,
    "internal/dns/promises": internalDnsPromises,
    "internal/errors": internalErrors,
    "internal/event_target": internalEventTarget,
    "internal/fs/utils": internalFsUtils,
    "internal/http": internalHttp,
    "internal/readline/utils": internalReadlineUtils,
    "internal/streams/add-abort-signal": internalStreamsAddAbortSignal,
    "internal/streams/buffer_list": internalStreamsBufferList,
    "internal/streams/lazy_transform": internalStreamsLazyTransform,
    "internal/streams/state": internalStreamsState,
    "internal/test/binding": internalTestBinding,
    "internal/timers": internalTimers,
    "internal/util/inspect": internalUtilInspect,
    "internal/util": internalUtil,
    net,
    os,
    "path/posix": pathPosix,
    "path/win32": pathWin32,
    path,
    perf_hooks: perfHooks,
    process,
    get punycode () {
        process.emitWarning("The `punycode` module is deprecated. Please use a userland " + "alternative instead.", "DeprecationWarning", "DEP0040");
        return punycode;
    },
    querystring,
    readline,
    "readline/promises": readlinePromises,
    repl,
    stream,
    "stream/consumers": streamConsumers,
    "stream/promises": streamPromises,
    "stream/web": streamWeb,
    string_decoder: stringDecoder,
    sys,
    timers,
    "timers/promises": timersPromises,
    tls,
    tty,
    url,
    util,
    "util/types": utilTypes,
    v8,
    vm,
    wasi,
    worker_threads: workerThreads,
    zlib
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL25vZGUvbW9kdWxlX2FsbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IF9odHRwX2FnZW50IGZyb20gXCIuL19odHRwX2FnZW50Lm1qc1wiO1xuaW1wb3J0IF9odHRwX291dGdvaW5nIGZyb20gXCIuL19odHRwX291dGdvaW5nLnRzXCI7XG5pbXBvcnQgX3N0cmVhbV9kdXBsZXggZnJvbSBcIi4vaW50ZXJuYWwvc3RyZWFtcy9kdXBsZXgubWpzXCI7XG5pbXBvcnQgX3N0cmVhbV9wYXNzdGhyb3VnaCBmcm9tIFwiLi9pbnRlcm5hbC9zdHJlYW1zL3Bhc3N0aHJvdWdoLm1qc1wiO1xuaW1wb3J0IF9zdHJlYW1fcmVhZGFibGUgZnJvbSBcIi4vaW50ZXJuYWwvc3RyZWFtcy9yZWFkYWJsZS5tanNcIjtcbmltcG9ydCBfc3RyZWFtX3RyYW5zZm9ybSBmcm9tIFwiLi9pbnRlcm5hbC9zdHJlYW1zL3RyYW5zZm9ybS5tanNcIjtcbmltcG9ydCBfc3RyZWFtX3dyaXRhYmxlIGZyb20gXCIuL2ludGVybmFsL3N0cmVhbXMvd3JpdGFibGUubWpzXCI7XG5pbXBvcnQgYXNzZXJ0IGZyb20gXCIuL2Fzc2VydC50c1wiO1xuaW1wb3J0IGFzc2VydFN0cmljdCBmcm9tIFwiLi9hc3NlcnQvc3RyaWN0LnRzXCI7XG5pbXBvcnQgYXN5bmNfaG9va3MgZnJvbSBcIi4vYXN5bmNfaG9va3MudHNcIjtcbmltcG9ydCBidWZmZXIgZnJvbSBcIi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgY2hpbGRQcm9jZXNzIGZyb20gXCIuL2NoaWxkX3Byb2Nlc3MudHNcIjtcbmltcG9ydCBjbHVzdGVyIGZyb20gXCIuL2NsdXN0ZXIudHNcIjtcbmltcG9ydCBjb25zb2xlIGZyb20gXCIuL2NvbnNvbGUudHNcIjtcbmltcG9ydCBjb25zdGFudHMgZnJvbSBcIi4vY29uc3RhbnRzLnRzXCI7XG5pbXBvcnQgY3J5cHRvIGZyb20gXCIuL2NyeXB0by50c1wiO1xuaW1wb3J0IGRncmFtIGZyb20gXCIuL2RncmFtLnRzXCI7XG5pbXBvcnQgZGlhZ25vc3RpY3NDaGFubmVsIGZyb20gXCIuL2RpYWdub3N0aWNzX2NoYW5uZWwudHNcIjtcbmltcG9ydCBkbnMgZnJvbSBcIi4vZG5zLnRzXCI7XG5pbXBvcnQgZG5zUHJvbWlzZXMgZnJvbSBcIi4vZG5zL3Byb21pc2VzLnRzXCI7XG5pbXBvcnQgZG9tYWluIGZyb20gXCIuL2RvbWFpbi50c1wiO1xuaW1wb3J0IGV2ZW50cyBmcm9tIFwiLi9ldmVudHMudHNcIjtcbmltcG9ydCBmcyBmcm9tIFwiLi9mcy50c1wiO1xuaW1wb3J0IGZzUHJvbWlzZXMgZnJvbSBcIi4vZnMvcHJvbWlzZXMudHNcIjtcbmltcG9ydCBodHRwIGZyb20gXCIuL2h0dHAudHNcIjtcbmltcG9ydCBodHRwMiBmcm9tIFwiLi9odHRwMi50c1wiO1xuaW1wb3J0IGh0dHBzIGZyb20gXCIuL2h0dHBzLnRzXCI7XG5pbXBvcnQgaW5zcGVjdG9yIGZyb20gXCIuL2luc3BlY3Rvci50c1wiO1xuaW1wb3J0IGludGVybmFsQ3AgZnJvbSBcIi4vaW50ZXJuYWwvY2hpbGRfcHJvY2Vzcy50c1wiO1xuaW1wb3J0IGludGVybmFsQ3J5cHRvQ2VydGlmaWNhdGUgZnJvbSBcIi4vaW50ZXJuYWwvY3J5cHRvL2NlcnRpZmljYXRlLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxDcnlwdG9DaXBoZXIgZnJvbSBcIi4vaW50ZXJuYWwvY3J5cHRvL2NpcGhlci50c1wiO1xuaW1wb3J0IGludGVybmFsQ3J5cHRvRGlmZmllaGVsbG1hbiBmcm9tIFwiLi9pbnRlcm5hbC9jcnlwdG8vZGlmZmllaGVsbG1hbi50c1wiO1xuaW1wb3J0IGludGVybmFsQ3J5cHRvSGFzaCBmcm9tIFwiLi9pbnRlcm5hbC9jcnlwdG8vaGFzaC50c1wiO1xuaW1wb3J0IGludGVybmFsQ3J5cHRvSGtkZiBmcm9tIFwiLi9pbnRlcm5hbC9jcnlwdG8vaGtkZi50c1wiO1xuaW1wb3J0IGludGVybmFsQ3J5cHRvS2V5Z2VuIGZyb20gXCIuL2ludGVybmFsL2NyeXB0by9rZXlnZW4udHNcIjtcbmltcG9ydCBpbnRlcm5hbENyeXB0b0tleXMgZnJvbSBcIi4vaW50ZXJuYWwvY3J5cHRvL2tleXMudHNcIjtcbmltcG9ydCBpbnRlcm5hbENyeXB0b1Bia2RmMiBmcm9tIFwiLi9pbnRlcm5hbC9jcnlwdG8vcGJrZGYyLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxDcnlwdG9SYW5kb20gZnJvbSBcIi4vaW50ZXJuYWwvY3J5cHRvL3JhbmRvbS50c1wiO1xuaW1wb3J0IGludGVybmFsQ3J5cHRvU2NyeXB0IGZyb20gXCIuL2ludGVybmFsL2NyeXB0by9zY3J5cHQudHNcIjtcbmltcG9ydCBpbnRlcm5hbENyeXB0b1NpZyBmcm9tIFwiLi9pbnRlcm5hbC9jcnlwdG8vc2lnLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxDcnlwdG9VdGlsIGZyb20gXCIuL2ludGVybmFsL2NyeXB0by91dGlsLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxDcnlwdG9YNTA5IGZyb20gXCIuL2ludGVybmFsL2NyeXB0by94NTA5LnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxEZ3JhbSBmcm9tIFwiLi9pbnRlcm5hbC9kZ3JhbS50c1wiO1xuaW1wb3J0IGludGVybmFsRG5zUHJvbWlzZXMgZnJvbSBcIi4vaW50ZXJuYWwvZG5zL3Byb21pc2VzLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxFcnJvcnMgZnJvbSBcIi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxFdmVudFRhcmdldCBmcm9tIFwiLi9pbnRlcm5hbC9ldmVudF90YXJnZXQubWpzXCI7XG5pbXBvcnQgaW50ZXJuYWxGc1V0aWxzIGZyb20gXCIuL2ludGVybmFsL2ZzL3V0aWxzLm1qc1wiO1xuaW1wb3J0IGludGVybmFsSHR0cCBmcm9tIFwiLi9pbnRlcm5hbC9odHRwLnRzXCI7XG5pbXBvcnQgaW50ZXJuYWxSZWFkbGluZVV0aWxzIGZyb20gXCIuL2ludGVybmFsL3JlYWRsaW5lL3V0aWxzLm1qc1wiO1xuaW1wb3J0IGludGVybmFsU3RyZWFtc0FkZEFib3J0U2lnbmFsIGZyb20gXCIuL2ludGVybmFsL3N0cmVhbXMvYWRkLWFib3J0LXNpZ25hbC5tanNcIjtcbmltcG9ydCBpbnRlcm5hbFN0cmVhbXNCdWZmZXJMaXN0IGZyb20gXCIuL2ludGVybmFsL3N0cmVhbXMvYnVmZmVyX2xpc3QubWpzXCI7XG5pbXBvcnQgaW50ZXJuYWxTdHJlYW1zTGF6eVRyYW5zZm9ybSBmcm9tIFwiLi9pbnRlcm5hbC9zdHJlYW1zL2xhenlfdHJhbnNmb3JtLm1qc1wiO1xuaW1wb3J0IGludGVybmFsU3RyZWFtc1N0YXRlIGZyb20gXCIuL2ludGVybmFsL3N0cmVhbXMvc3RhdGUubWpzXCI7XG5pbXBvcnQgaW50ZXJuYWxUZXN0QmluZGluZyBmcm9tIFwiLi9pbnRlcm5hbC90ZXN0L2JpbmRpbmcudHNcIjtcbmltcG9ydCBpbnRlcm5hbFRpbWVycyBmcm9tIFwiLi9pbnRlcm5hbC90aW1lcnMubWpzXCI7XG5pbXBvcnQgaW50ZXJuYWxVdGlsIGZyb20gXCIuL2ludGVybmFsL3V0aWwubWpzXCI7XG5pbXBvcnQgaW50ZXJuYWxVdGlsSW5zcGVjdCBmcm9tIFwiLi9pbnRlcm5hbC91dGlsL2luc3BlY3QubWpzXCI7XG5pbXBvcnQgbmV0IGZyb20gXCIuL25ldC50c1wiO1xuaW1wb3J0IG9zIGZyb20gXCIuL29zLnRzXCI7XG5pbXBvcnQgcGF0aFBvc2l4IGZyb20gXCIuL3BhdGgvcG9zaXgudHNcIjtcbmltcG9ydCBwYXRoV2luMzIgZnJvbSBcIi4vcGF0aC93aW4zMi50c1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcIi4vcGF0aC50c1wiO1xuaW1wb3J0IHBlcmZIb29rcyBmcm9tIFwiLi9wZXJmX2hvb2tzLnRzXCI7XG5pbXBvcnQgcHVueWNvZGUgZnJvbSBcIi4vcHVueWNvZGUudHNcIjtcbmltcG9ydCBwcm9jZXNzIGZyb20gXCIuL3Byb2Nlc3MudHNcIjtcbmltcG9ydCBxdWVyeXN0cmluZyBmcm9tIFwiLi9xdWVyeXN0cmluZy50c1wiO1xuaW1wb3J0IHJlYWRsaW5lIGZyb20gXCIuL3JlYWRsaW5lLnRzXCI7XG5pbXBvcnQgcmVhZGxpbmVQcm9taXNlcyBmcm9tIFwiLi9yZWFkbGluZS9wcm9taXNlcy50c1wiO1xuaW1wb3J0IHJlcGwgZnJvbSBcIi4vcmVwbC50c1wiO1xuaW1wb3J0IHN0cmVhbSBmcm9tIFwiLi9zdHJlYW0udHNcIjtcbmltcG9ydCBzdHJlYW1Db25zdW1lcnMgZnJvbSBcIi4vc3RyZWFtL2NvbnN1bWVycy5tanNcIjtcbmltcG9ydCBzdHJlYW1Qcm9taXNlcyBmcm9tIFwiLi9zdHJlYW0vcHJvbWlzZXMubWpzXCI7XG5pbXBvcnQgc3RyZWFtV2ViIGZyb20gXCIuL3N0cmVhbS93ZWIudHNcIjtcbmltcG9ydCBzdHJpbmdEZWNvZGVyIGZyb20gXCIuL3N0cmluZ19kZWNvZGVyLnRzXCI7XG5pbXBvcnQgc3lzIGZyb20gXCIuL3N5cy50c1wiO1xuaW1wb3J0IHRpbWVycyBmcm9tIFwiLi90aW1lcnMudHNcIjtcbmltcG9ydCB0aW1lcnNQcm9taXNlcyBmcm9tIFwiLi90aW1lcnMvcHJvbWlzZXMudHNcIjtcbmltcG9ydCB0bHMgZnJvbSBcIi4vdGxzLnRzXCI7XG5pbXBvcnQgdHR5IGZyb20gXCIuL3R0eS50c1wiO1xuaW1wb3J0IHVybCBmcm9tIFwiLi91cmwudHNcIjtcbmltcG9ydCB1dGlsVHlwZXMgZnJvbSBcIi4vdXRpbC90eXBlcy50c1wiO1xuaW1wb3J0IHV0aWwgZnJvbSBcIi4vdXRpbC50c1wiO1xuaW1wb3J0IHY4IGZyb20gXCIuL3Y4LnRzXCI7XG5pbXBvcnQgdm0gZnJvbSBcIi4vdm0udHNcIjtcbmltcG9ydCB3b3JrZXJUaHJlYWRzIGZyb20gXCIuL3dvcmtlcl90aHJlYWRzLnRzXCI7XG5pbXBvcnQgd2FzaSBmcm9tIFwiLi93YXNpLnRzXCI7XG5pbXBvcnQgemxpYiBmcm9tIFwiLi96bGliLnRzXCI7XG5cbi8vIENhbm9uaWNhbCBtYXBwaW5nIG9mIHN1cHBvcnRlZCBtb2R1bGVzXG5leHBvcnQgZGVmYXVsdCB7XG4gIF9odHRwX2FnZW50LFxuICBfaHR0cF9vdXRnb2luZyxcbiAgX3N0cmVhbV9kdXBsZXgsXG4gIF9zdHJlYW1fcGFzc3Rocm91Z2gsXG4gIF9zdHJlYW1fcmVhZGFibGUsXG4gIF9zdHJlYW1fdHJhbnNmb3JtLFxuICBfc3RyZWFtX3dyaXRhYmxlLFxuICBhc3NlcnQsXG4gIFwiYXNzZXJ0L3N0cmljdFwiOiBhc3NlcnRTdHJpY3QsXG4gIGFzeW5jX2hvb2tzLFxuICBidWZmZXIsXG4gIGNyeXB0byxcbiAgY29uc29sZSxcbiAgY29uc3RhbnRzLFxuICBjaGlsZF9wcm9jZXNzOiBjaGlsZFByb2Nlc3MsXG4gIGNsdXN0ZXIsXG4gIGRncmFtLFxuICBkaWFnbm9zdGljc19jaGFubmVsOiBkaWFnbm9zdGljc0NoYW5uZWwsXG4gIGRucyxcbiAgXCJkbnMvcHJvbWlzZXNcIjogZG5zUHJvbWlzZXMsXG4gIGRvbWFpbixcbiAgZXZlbnRzLFxuICBmcyxcbiAgXCJmcy9wcm9taXNlc1wiOiBmc1Byb21pc2VzLFxuICBodHRwLFxuICBodHRwMixcbiAgaHR0cHMsXG4gIGluc3BlY3RvcixcbiAgXCJpbnRlcm5hbC9jaGlsZF9wcm9jZXNzXCI6IGludGVybmFsQ3AsXG4gIFwiaW50ZXJuYWwvY3J5cHRvL2NlcnRpZmljYXRlXCI6IGludGVybmFsQ3J5cHRvQ2VydGlmaWNhdGUsXG4gIFwiaW50ZXJuYWwvY3J5cHRvL2NpcGhlclwiOiBpbnRlcm5hbENyeXB0b0NpcGhlcixcbiAgXCJpbnRlcm5hbC9jcnlwdG8vZGlmZmllaGVsbG1hblwiOiBpbnRlcm5hbENyeXB0b0RpZmZpZWhlbGxtYW4sXG4gIFwiaW50ZXJuYWwvY3J5cHRvL2hhc2hcIjogaW50ZXJuYWxDcnlwdG9IYXNoLFxuICBcImludGVybmFsL2NyeXB0by9oa2RmXCI6IGludGVybmFsQ3J5cHRvSGtkZixcbiAgXCJpbnRlcm5hbC9jcnlwdG8va2V5Z2VuXCI6IGludGVybmFsQ3J5cHRvS2V5Z2VuLFxuICBcImludGVybmFsL2NyeXB0by9rZXlzXCI6IGludGVybmFsQ3J5cHRvS2V5cyxcbiAgXCJpbnRlcm5hbC9jcnlwdG8vcGJrZGYyXCI6IGludGVybmFsQ3J5cHRvUGJrZGYyLFxuICBcImludGVybmFsL2NyeXB0by9yYW5kb21cIjogaW50ZXJuYWxDcnlwdG9SYW5kb20sXG4gIFwiaW50ZXJuYWwvY3J5cHRvL3NjcnlwdFwiOiBpbnRlcm5hbENyeXB0b1NjcnlwdCxcbiAgXCJpbnRlcm5hbC9jcnlwdG8vc2lnXCI6IGludGVybmFsQ3J5cHRvU2lnLFxuICBcImludGVybmFsL2NyeXB0by91dGlsXCI6IGludGVybmFsQ3J5cHRvVXRpbCxcbiAgXCJpbnRlcm5hbC9jcnlwdG8veDUwOVwiOiBpbnRlcm5hbENyeXB0b1g1MDksXG4gIFwiaW50ZXJuYWwvZGdyYW1cIjogaW50ZXJuYWxEZ3JhbSxcbiAgXCJpbnRlcm5hbC9kbnMvcHJvbWlzZXNcIjogaW50ZXJuYWxEbnNQcm9taXNlcyxcbiAgXCJpbnRlcm5hbC9lcnJvcnNcIjogaW50ZXJuYWxFcnJvcnMsXG4gIFwiaW50ZXJuYWwvZXZlbnRfdGFyZ2V0XCI6IGludGVybmFsRXZlbnRUYXJnZXQsXG4gIFwiaW50ZXJuYWwvZnMvdXRpbHNcIjogaW50ZXJuYWxGc1V0aWxzLFxuICBcImludGVybmFsL2h0dHBcIjogaW50ZXJuYWxIdHRwLFxuICBcImludGVybmFsL3JlYWRsaW5lL3V0aWxzXCI6IGludGVybmFsUmVhZGxpbmVVdGlscyxcbiAgXCJpbnRlcm5hbC9zdHJlYW1zL2FkZC1hYm9ydC1zaWduYWxcIjogaW50ZXJuYWxTdHJlYW1zQWRkQWJvcnRTaWduYWwsXG4gIFwiaW50ZXJuYWwvc3RyZWFtcy9idWZmZXJfbGlzdFwiOiBpbnRlcm5hbFN0cmVhbXNCdWZmZXJMaXN0LFxuICBcImludGVybmFsL3N0cmVhbXMvbGF6eV90cmFuc2Zvcm1cIjogaW50ZXJuYWxTdHJlYW1zTGF6eVRyYW5zZm9ybSxcbiAgXCJpbnRlcm5hbC9zdHJlYW1zL3N0YXRlXCI6IGludGVybmFsU3RyZWFtc1N0YXRlLFxuICBcImludGVybmFsL3Rlc3QvYmluZGluZ1wiOiBpbnRlcm5hbFRlc3RCaW5kaW5nLFxuICBcImludGVybmFsL3RpbWVyc1wiOiBpbnRlcm5hbFRpbWVycyxcbiAgXCJpbnRlcm5hbC91dGlsL2luc3BlY3RcIjogaW50ZXJuYWxVdGlsSW5zcGVjdCxcbiAgXCJpbnRlcm5hbC91dGlsXCI6IGludGVybmFsVXRpbCxcbiAgbmV0LFxuICBvcyxcbiAgXCJwYXRoL3Bvc2l4XCI6IHBhdGhQb3NpeCxcbiAgXCJwYXRoL3dpbjMyXCI6IHBhdGhXaW4zMixcbiAgcGF0aCxcbiAgcGVyZl9ob29rczogcGVyZkhvb2tzLFxuICBwcm9jZXNzLFxuICBnZXQgcHVueWNvZGUoKSB7XG4gICAgcHJvY2Vzcy5lbWl0V2FybmluZyhcbiAgICAgIFwiVGhlIGBwdW55Y29kZWAgbW9kdWxlIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgYSB1c2VybGFuZCBcIiArXG4gICAgICAgIFwiYWx0ZXJuYXRpdmUgaW5zdGVhZC5cIixcbiAgICAgIFwiRGVwcmVjYXRpb25XYXJuaW5nXCIsXG4gICAgICBcIkRFUDAwNDBcIixcbiAgICApO1xuICAgIHJldHVybiBwdW55Y29kZTtcbiAgfSxcbiAgcXVlcnlzdHJpbmcsXG4gIHJlYWRsaW5lLFxuICBcInJlYWRsaW5lL3Byb21pc2VzXCI6IHJlYWRsaW5lUHJvbWlzZXMsXG4gIHJlcGwsXG4gIHN0cmVhbSxcbiAgXCJzdHJlYW0vY29uc3VtZXJzXCI6IHN0cmVhbUNvbnN1bWVycyxcbiAgXCJzdHJlYW0vcHJvbWlzZXNcIjogc3RyZWFtUHJvbWlzZXMsXG4gIFwic3RyZWFtL3dlYlwiOiBzdHJlYW1XZWIsXG4gIHN0cmluZ19kZWNvZGVyOiBzdHJpbmdEZWNvZGVyLFxuICBzeXMsXG4gIHRpbWVycyxcbiAgXCJ0aW1lcnMvcHJvbWlzZXNcIjogdGltZXJzUHJvbWlzZXMsXG4gIHRscyxcbiAgdHR5LFxuICB1cmwsXG4gIHV0aWwsXG4gIFwidXRpbC90eXBlc1wiOiB1dGlsVHlwZXMsXG4gIHY4LFxuICB2bSxcbiAgd2FzaSxcbiAgd29ya2VyX3RocmVhZHM6IHdvcmtlclRocmVhZHMsXG4gIHpsaWIsXG59IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxPQUFPLGlCQUFpQixvQkFBb0I7QUFDNUMsT0FBTyxvQkFBb0Isc0JBQXNCO0FBQ2pELE9BQU8sb0JBQW9CLGdDQUFnQztBQUMzRCxPQUFPLHlCQUF5QixxQ0FBcUM7QUFDckUsT0FBTyxzQkFBc0Isa0NBQWtDO0FBQy9ELE9BQU8sdUJBQXVCLG1DQUFtQztBQUNqRSxPQUFPLHNCQUFzQixrQ0FBa0M7QUFDL0QsT0FBTyxZQUFZLGNBQWM7QUFDakMsT0FBTyxrQkFBa0IscUJBQXFCO0FBQzlDLE9BQU8saUJBQWlCLG1CQUFtQjtBQUMzQyxPQUFPLFlBQVksY0FBYztBQUNqQyxPQUFPLGtCQUFrQixxQkFBcUI7QUFDOUMsT0FBTyxhQUFhLGVBQWU7QUFDbkMsT0FBTyxhQUFhLGVBQWU7QUFDbkMsT0FBTyxlQUFlLGlCQUFpQjtBQUN2QyxPQUFPLFlBQVksY0FBYztBQUNqQyxPQUFPLFdBQVcsYUFBYTtBQUMvQixPQUFPLHdCQUF3QiwyQkFBMkI7QUFDMUQsT0FBTyxTQUFTLFdBQVc7QUFDM0IsT0FBTyxpQkFBaUIsb0JBQW9CO0FBQzVDLE9BQU8sWUFBWSxjQUFjO0FBQ2pDLE9BQU8sWUFBWSxjQUFjO0FBQ2pDLE9BQU8sUUFBUSxVQUFVO0FBQ3pCLE9BQU8sZ0JBQWdCLG1CQUFtQjtBQUMxQyxPQUFPLFVBQVUsWUFBWTtBQUM3QixPQUFPLFdBQVcsYUFBYTtBQUMvQixPQUFPLFdBQVcsYUFBYTtBQUMvQixPQUFPLGVBQWUsaUJBQWlC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