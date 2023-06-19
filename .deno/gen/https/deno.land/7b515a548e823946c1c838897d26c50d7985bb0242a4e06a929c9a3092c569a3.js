// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// deno-lint-ignore-file no-unused-vars
/**
 * Provides an implementation of the
 * [WebAssembly System Interface](https://wasi.dev/).
 *
 * ## Supported Syscalls
 * - [x] args_get
 * - [x] args_sizes_get
 * - [x] environ_get
 * - [x] environ_sizes_get
 * - [x] clock_res_get
 * - [x] clock_time_get
 * - [ ] fd_advise
 * - [ ] fd_allocate
 * - [x] fd_close
 * - [x] fd_datasync
 * - [x] fd_fdstat_get
 * - [ ] fd_fdstat_set_flags
 * - [ ] fd_fdstat_set_rights
 * - [x] fd_filestat_get
 * - [x] fd_filestat_set_size
 * - [x] fd_filestat_set_times
 * - [x] fd_pread
 * - [x] fd_prestat_get
 * - [x] fd_prestat_dir_name
 * - [x] fd_pwrite
 * - [x] fd_read
 * - [x] fd_readdir
 * - [x] fd_renumber
 * - [x] fd_seek
 * - [x] fd_sync
 * - [x] fd_tell
 * - [x] fd_write
 * - [x] path_create_directory
 * - [x] path_filestat_get
 * - [x] path_filestat_set_times
 * - [x] path_link
 * - [x] path_open
 * - [x] path_readlink
 * - [x] path_remove_directory
 * - [x] path_rename
 * - [x] path_symlink
 * - [x] path_unlink_file
 * - [x] poll_oneoff
 * - [x] proc_exit
 * - [ ] proc_raise
 * - [x] sched_yield
 * - [x] random_get
 * - [ ] sock_recv
 * - [ ] sock_send
 * - [ ] sock_shutdown
 *
 * @example
 * ```ts
 * import Context from "https://deno.land/std@$STD_VERSION/wasi/snapshot_preview1.ts";
 *
 * const context = new Context({
 *   args: Deno.args,
 *   env: Deno.env.toObject(),
 * });
 *
 * const binary = await Deno.readFile("path/to/your/module.wasm");
 * const module = await WebAssembly.compile(binary);
 * const instance = await WebAssembly.instantiate(module, {
 *   "wasi_snapshot_preview1": context.exports,
 * });
 *
 * context.start(instance);
 * ```
 *
 * @module
 */ import { relative, resolve } from "../path/mod.ts";
const CLOCKID_REALTIME = 0;
const CLOCKID_MONOTONIC = 1;
const CLOCKID_PROCESS_CPUTIME_ID = 2;
const CLOCKID_THREAD_CPUTIME_ID = 3;
const ERRNO_SUCCESS = 0;
const _ERRNO_2BIG = 1;
const ERRNO_ACCES = 2;
const ERRNO_ADDRINUSE = 3;
const ERRNO_ADDRNOTAVAIL = 4;
const _ERRNO_AFNOSUPPORT = 5;
const _ERRNO_AGAIN = 6;
const _ERRNO_ALREADY = 7;
const ERRNO_BADF = 8;
const _ERRNO_BADMSG = 9;
const ERRNO_BUSY = 10;
const _ERRNO_CANCELED = 11;
const _ERRNO_CHILD = 12;
const ERRNO_CONNABORTED = 13;
const ERRNO_CONNREFUSED = 14;
const ERRNO_CONNRESET = 15;
const _ERRNO_DEADLK = 16;
const _ERRNO_DESTADDRREQ = 17;
const _ERRNO_DOM = 18;
const _ERRNO_DQUOT = 19;
const _ERRNO_EXIST = 20;
const _ERRNO_FAULT = 21;
const _ERRNO_FBIG = 22;
const _ERRNO_HOSTUNREACH = 23;
const _ERRNO_IDRM = 24;
const _ERRNO_ILSEQ = 25;
const _ERRNO_INPROGRESS = 26;
const ERRNO_INTR = 27;
const ERRNO_INVAL = 28;
const _ERRNO_IO = 29;
const _ERRNO_ISCONN = 30;
const _ERRNO_ISDIR = 31;
const _ERRNO_LOOP = 32;
const _ERRNO_MFILE = 33;
const _ERRNO_MLINK = 34;
const _ERRNO_MSGSIZE = 35;
const _ERRNO_MULTIHOP = 36;
const _ERRNO_NAMETOOLONG = 37;
const _ERRNO_NETDOWN = 38;
const _ERRNO_NETRESET = 39;
const _ERRNO_NETUNREACH = 40;
const _ERRNO_NFILE = 41;
const _ERRNO_NOBUFS = 42;
const _ERRNO_NODEV = 43;
const ERRNO_NOENT = 44;
const _ERRNO_NOEXEC = 45;
const _ERRNO_NOLCK = 46;
const _ERRNO_NOLINK = 47;
const _ERRNO_NOMEM = 48;
const _ERRNO_NOMSG = 49;
const _ERRNO_NOPROTOOPT = 50;
const _ERRNO_NOSPC = 51;
const ERRNO_NOSYS = 52;
const ERRNO_NOTCONN = 53;
const ERRNO_NOTDIR = 54;
const _ERRNO_NOTEMPTY = 55;
const _ERRNO_NOTRECOVERABLE = 56;
const _ERRNO_NOTSOCK = 57;
const _ERRNO_NOTSUP = 58;
const _ERRNO_NOTTY = 59;
const _ERRNO_NXIO = 60;
const _ERRNO_OVERFLOW = 61;
const _ERRNO_OWNERDEAD = 62;
const _ERRNO_PERM = 63;
const ERRNO_PIPE = 64;
const _ERRNO_PROTO = 65;
const _ERRNO_PROTONOSUPPORT = 66;
const _ERRNO_PROTOTYPE = 67;
const _ERRNO_RANGE = 68;
const _ERRNO_ROFS = 69;
const _ERRNO_SPIPE = 70;
const _ERRNO_SRCH = 71;
const _ERRNO_STALE = 72;
const ERRNO_TIMEDOUT = 73;
const _ERRNO_TXTBSY = 74;
const _ERRNO_XDEV = 75;
const ERRNO_NOTCAPABLE = 76;
const RIGHTS_FD_DATASYNC = 0x0000000000000001n;
const RIGHTS_FD_READ = 0x0000000000000002n;
const _RIGHTS_FD_SEEK = 0x0000000000000004n;
const _RIGHTS_FD_FDSTAT_SET_FLAGS = 0x0000000000000008n;
const _RIGHTS_FD_SYNC = 0x0000000000000010n;
const _RIGHTS_FD_TELL = 0x0000000000000020n;
const RIGHTS_FD_WRITE = 0x0000000000000040n;
const _RIGHTS_FD_ADVISE = 0x0000000000000080n;
const RIGHTS_FD_ALLOCATE = 0x0000000000000100n;
const _RIGHTS_PATH_CREATE_DIRECTORY = 0x0000000000000200n;
const _RIGHTS_PATH_CREATE_FILE = 0x0000000000000400n;
const _RIGHTS_PATH_LINK_SOURCE = 0x0000000000000800n;
const _RIGHTS_PATH_LINK_TARGET = 0x0000000000001000n;
const _RIGHTS_PATH_OPEN = 0x0000000000002000n;
const RIGHTS_FD_READDIR = 0x0000000000004000n;
const _RIGHTS_PATH_READLINK = 0x0000000000008000n;
const _RIGHTS_PATH_RENAME_SOURCE = 0x0000000000010000n;
const _RIGHTS_PATH_RENAME_TARGET = 0x0000000000020000n;
const _RIGHTS_PATH_FILESTAT_GET = 0x0000000000040000n;
const _RIGHTS_PATH_FILESTAT_SET_SIZE = 0x0000000000080000n;
const _RIGHTS_PATH_FILESTAT_SET_TIMES = 0x0000000000100000n;
const _RIGHTS_FD_FILESTAT_GET = 0x0000000000200000n;
const RIGHTS_FD_FILESTAT_SET_SIZE = 0x0000000000400000n;
const _RIGHTS_FD_FILESTAT_SET_TIMES = 0x0000000000800000n;
const _RIGHTS_PATH_SYMLINK = 0x0000000001000000n;
const _RIGHTS_PATH_REMOVE_DIRECTORY = 0x0000000002000000n;
const _RIGHTS_PATH_UNLINK_FILE = 0x0000000004000000n;
const _RIGHTS_POLL_FD_READWRITE = 0x0000000008000000n;
const _RIGHTS_SOCK_SHUTDOWN = 0x0000000010000000n;
const _WHENCE_SET = 0;
const _WHENCE_CUR = 1;
const _WHENCE_END = 2;
const FILETYPE_UNKNOWN = 0;
const _FILETYPE_BLOCK_DEVICE = 1;
const FILETYPE_CHARACTER_DEVICE = 2;
const FILETYPE_DIRECTORY = 3;
const FILETYPE_REGULAR_FILE = 4;
const _FILETYPE_SOCKET_DGRAM = 5;
const _FILETYPE_SOCKET_STREAM = 6;
const FILETYPE_SYMBOLIC_LINK = 7;
const _ADVICE_NORMAL = 0;
const _ADVICE_SEQUENTIAL = 1;
const _ADVICE_RANDOM = 2;
const _ADVICE_WILLNEED = 3;
const _ADVICE_DONTNEED = 4;
const _ADVICE_NOREUSE = 5;
const FDFLAGS_APPEND = 0x0001;
const FDFLAGS_DSYNC = 0x0002;
const FDFLAGS_NONBLOCK = 0x0004;
const FDFLAGS_RSYNC = 0x0008;
const FDFLAGS_SYNC = 0x0010;
const _FSTFLAGS_ATIM = 0x0001;
const FSTFLAGS_ATIM_NOW = 0x0002;
const _FSTFLAGS_MTIM = 0x0004;
const FSTFLAGS_MTIM_NOW = 0x0008;
const LOOKUPFLAGS_SYMLINK_FOLLOW = 0x0001;
const OFLAGS_CREAT = 0x0001;
const OFLAGS_DIRECTORY = 0x0002;
const OFLAGS_EXCL = 0x0004;
const OFLAGS_TRUNC = 0x0008;
const _EVENTTYPE_CLOCK = 0;
const _EVENTTYPE_FD_READ = 1;
const _EVENTTYPE_FD_WRITE = 2;
const _EVENTRWFLAGS_FD_READWRITE_HANGUP = 1;
const _SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME = 1;
const _SIGNAL_NONE = 0;
const _SIGNAL_HUP = 1;
const _SIGNAL_INT = 2;
const _SIGNAL_QUIT = 3;
const _SIGNAL_ILL = 4;
const _SIGNAL_TRAP = 5;
const _SIGNAL_ABRT = 6;
const _SIGNAL_BUS = 7;
const _SIGNAL_FPE = 8;
const _SIGNAL_KILL = 9;
const _SIGNAL_USR1 = 10;
const _SIGNAL_SEGV = 11;
const _SIGNAL_USR2 = 12;
const _SIGNAL_PIPE = 13;
const _SIGNAL_ALRM = 14;
const _SIGNAL_TERM = 15;
const _SIGNAL_CHLD = 16;
const _SIGNAL_CONT = 17;
const _SIGNAL_STOP = 18;
const _SIGNAL_TSTP = 19;
const _SIGNAL_TTIN = 20;
const _SIGNAL_TTOU = 21;
const _SIGNAL_URG = 22;
const _SIGNAL_XCPU = 23;
const _SIGNAL_XFSZ = 24;
const _SIGNAL_VTALRM = 25;
const _SIGNAL_PROF = 26;
const _SIGNAL_WINCH = 27;
const _SIGNAL_POLL = 28;
const _SIGNAL_PWR = 29;
const _SIGNAL_SYS = 30;
const _RIFLAGS_RECV_PEEK = 0x0001;
const _RIFLAGS_RECV_WAITALL = 0x0002;
const _ROFLAGS_RECV_DATA_TRUNCATED = 0x0001;
const _SDFLAGS_RD = 0x0001;
const _SDFLAGS_WR = 0x0002;
const PREOPENTYPE_DIR = 0;
function syscall(target) {
    return function(...args) {
        try {
            return target(...args);
        } catch (err) {
            if (err instanceof ExitStatus) {
                throw err;
            }
            if (!(err instanceof Error)) {
                return ERRNO_INVAL;
            }
            switch(err.name){
                case "NotFound":
                    return ERRNO_NOENT;
                case "PermissionDenied":
                    return ERRNO_ACCES;
                case "ConnectionRefused":
                    return ERRNO_CONNREFUSED;
                case "ConnectionReset":
                    return ERRNO_CONNRESET;
                case "ConnectionAborted":
                    return ERRNO_CONNABORTED;
                case "NotConnected":
                    return ERRNO_NOTCONN;
                case "AddrInUse":
                    return ERRNO_ADDRINUSE;
                case "AddrNotAvailable":
                    return ERRNO_ADDRNOTAVAIL;
                case "BrokenPipe":
                    return ERRNO_PIPE;
                case "InvalidData":
                    return ERRNO_INVAL;
                case "TimedOut":
                    return ERRNO_TIMEDOUT;
                case "Interrupted":
                    return ERRNO_INTR;
                case "BadResource":
                    return ERRNO_BADF;
                case "Busy":
                    return ERRNO_BUSY;
                default:
                    return ERRNO_INVAL;
            }
        }
    };
}
class ExitStatus {
    code;
    constructor(code){
        this.code = code;
    }
}
/**
 * The Context class provides the environment required to run WebAssembly
 * modules compiled to run with the WebAssembly System Interface.
 *
 * Each context represents a distinct sandboxed environment and must have its
 * command-line arguments, environment variables, and pre-opened directory
 * structure configured explicitly.
 */ export default class Context {
    #args;
    #env;
    #exitOnReturn;
    #memory;
    #fds;
    #started;
    exports;
    constructor(options = {}){
        this.#args = options.args ?? [];
        this.#env = options.env ?? {};
        this.#exitOnReturn = options.exitOnReturn ?? true;
        this.#memory = null;
        this.#fds = [
            {
                rid: options.stdin ?? Deno.stdin.rid,
                type: FILETYPE_CHARACTER_DEVICE,
                flags: FDFLAGS_APPEND
            },
            {
                rid: options.stdout ?? Deno.stdout.rid,
                type: FILETYPE_CHARACTER_DEVICE,
                flags: FDFLAGS_APPEND
            },
            {
                rid: options.stderr ?? Deno.stderr.rid,
                type: FILETYPE_CHARACTER_DEVICE,
                flags: FDFLAGS_APPEND
            }
        ];
        if (options.preopens) {
            for (const [vpath, path] of Object.entries(options.preopens)){
                const type = FILETYPE_DIRECTORY;
                const entries = Array.from(Deno.readDirSync(path));
                const entry = {
                    type,
                    entries,
                    path,
                    vpath
                };
                this.#fds.push(entry);
            }
        }
        this.exports = {
            "args_get": syscall((argvOffset, argvBufferOffset)=>{
                const args = this.#args;
                const textEncoder = new TextEncoder();
                const memoryData = new Uint8Array(this.#memory.buffer);
                const memoryView = new DataView(this.#memory.buffer);
                for (const arg of args){
                    memoryView.setUint32(argvOffset, argvBufferOffset, true);
                    argvOffset += 4;
                    const data = textEncoder.encode(`${arg}\0`);
                    memoryData.set(data, argvBufferOffset);
                    argvBufferOffset += data.length;
                }
                return ERRNO_SUCCESS;
            }),
            "args_sizes_get": syscall((argcOffset, argvBufferSizeOffset)=>{
                const args = this.#args;
                const textEncoder = new TextEncoder();
                const memoryView = new DataView(this.#memory.buffer);
                memoryView.setUint32(argcOffset, args.length, true);
                memoryView.setUint32(argvBufferSizeOffset, args.reduce(function(acc, arg) {
                    return acc + textEncoder.encode(`${arg}\0`).length;
                }, 0), true);
                return ERRNO_SUCCESS;
            }),
            "environ_get": syscall((environOffset, environBufferOffset)=>{
                const entries = Object.entries(this.#env);
                const textEncoder = new TextEncoder();
                const memoryData = new Uint8Array(this.#memory.buffer);
                const memoryView = new DataView(this.#memory.buffer);
                for (const [key, value] of entries){
                    memoryView.setUint32(environOffset, environBufferOffset, true);
                    environOffset += 4;
                    const data = textEncoder.encode(`${key}=${value}\0`);
                    memoryData.set(data, environBufferOffset);
                    environBufferOffset += data.length;
                }
                return ERRNO_SUCCESS;
            }),
            "environ_sizes_get": syscall((environcOffset, environBufferSizeOffset)=>{
                const entries = Object.entries(this.#env);
                const textEncoder = new TextEncoder();
                const memoryView = new DataView(this.#memory.buffer);
                memoryView.setUint32(environcOffset, entries.length, true);
                memoryView.setUint32(environBufferSizeOffset, entries.reduce(function(acc, [key, value]) {
                    return acc + textEncoder.encode(`${key}=${value}\0`).length;
                }, 0), true);
                return ERRNO_SUCCESS;
            }),
            "clock_res_get": syscall((id, resolutionOffset)=>{
                const memoryView = new DataView(this.#memory.buffer);
                switch(id){
                    case CLOCKID_REALTIME:
                        {
                            const resolution = BigInt(1e6);
                            memoryView.setBigUint64(resolutionOffset, resolution, true);
                            break;
                        }
                    case CLOCKID_MONOTONIC:
                    case CLOCKID_PROCESS_CPUTIME_ID:
                    case CLOCKID_THREAD_CPUTIME_ID:
                        {
                            const resolution1 = BigInt(1e3);
                            memoryView.setBigUint64(resolutionOffset, resolution1, true);
                            break;
                        }
                    default:
                        return ERRNO_INVAL;
                }
                return ERRNO_SUCCESS;
            }),
            "clock_time_get": syscall((id, precision, timeOffset)=>{
                const memoryView = new DataView(this.#memory.buffer);
                switch(id){
                    case CLOCKID_REALTIME:
                        {
                            const time = BigInt(Date.now()) * BigInt(1e6);
                            memoryView.setBigUint64(timeOffset, time, true);
                            break;
                        }
                    case CLOCKID_MONOTONIC:
                    case CLOCKID_PROCESS_CPUTIME_ID:
                    case CLOCKID_THREAD_CPUTIME_ID:
                        {
                            const t = performance.now();
                            const s = Math.trunc(t);
                            const ms = Math.floor((t - s) * 1e3);
                            const time1 = BigInt(s) * BigInt(1e9) + BigInt(ms) * BigInt(1e6);
                            memoryView.setBigUint64(timeOffset, time1, true);
                            break;
                        }
                    default:
                        return ERRNO_INVAL;
                }
                return ERRNO_SUCCESS;
            }),
            "fd_advise": syscall((_fd, _offset, _length, _advice)=>{
                return ERRNO_NOSYS;
            }),
            "fd_allocate": syscall((_fd, _offset, _length)=>{
                return ERRNO_NOSYS;
            }),
            "fd_close": syscall((fd)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (entry.rid) {
                    Deno.close(entry.rid);
                }
                delete this.#fds[fd];
                return ERRNO_SUCCESS;
            }),
            "fd_datasync": syscall((fd)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                Deno.fdatasyncSync(entry.rid);
                return ERRNO_SUCCESS;
            }),
            "fd_fdstat_get": syscall((fd, offset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                memoryView.setUint8(offset, entry.type);
                memoryView.setUint16(offset + 2, entry.flags, true);
                // TODO(bartlomieju)
                memoryView.setBigUint64(offset + 8, 0n, true);
                // TODO(bartlomieju)
                memoryView.setBigUint64(offset + 16, 0n, true);
                return ERRNO_SUCCESS;
            }),
            "fd_fdstat_set_flags": syscall((_fd, _flags)=>{
                return ERRNO_NOSYS;
            }),
            "fd_fdstat_set_rights": syscall((_fd, _rightsBase, _rightsInheriting)=>{
                return ERRNO_NOSYS;
            }),
            "fd_filestat_get": syscall((fd, offset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                const info = Deno.fstatSync(entry.rid);
                if (entry.type === undefined) {
                    switch(true){
                        case info.isFile:
                            entry.type = FILETYPE_REGULAR_FILE;
                            break;
                        case info.isDirectory:
                            entry.type = FILETYPE_DIRECTORY;
                            break;
                        case info.isSymlink:
                            entry.type = FILETYPE_SYMBOLIC_LINK;
                            break;
                        default:
                            entry.type = FILETYPE_UNKNOWN;
                            break;
                    }
                }
                memoryView.setBigUint64(offset, BigInt(info.dev ? info.dev : 0), true);
                offset += 8;
                memoryView.setBigUint64(offset, BigInt(info.ino ? info.ino : 0), true);
                offset += 8;
                memoryView.setUint8(offset, entry.type);
                offset += 8;
                memoryView.setUint32(offset, Number(info.nlink), true);
                offset += 8;
                memoryView.setBigUint64(offset, BigInt(info.size), true);
                offset += 8;
                memoryView.setBigUint64(offset, BigInt(info.atime ? info.atime.getTime() * 1e6 : 0), true);
                offset += 8;
                memoryView.setBigUint64(offset, BigInt(info.mtime ? info.mtime.getTime() * 1e6 : 0), true);
                offset += 8;
                memoryView.setBigUint64(offset, BigInt(info.birthtime ? info.birthtime.getTime() * 1e6 : 0), true);
                offset += 8;
                return ERRNO_SUCCESS;
            }),
            "fd_filestat_set_size": syscall((fd, size)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                Deno.ftruncateSync(entry.rid, Number(size));
                return ERRNO_SUCCESS;
            }),
            "fd_filestat_set_times": syscall((fd, atim, mtim, flags)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                if ((flags & FSTFLAGS_ATIM_NOW) == FSTFLAGS_ATIM_NOW) {
                    atim = BigInt(Date.now() * 1e6);
                }
                if ((flags & FSTFLAGS_MTIM_NOW) == FSTFLAGS_MTIM_NOW) {
                    mtim = BigInt(Date.now() * 1e6);
                }
                Deno.utimeSync(entry.path, Number(atim), Number(mtim));
                return ERRNO_SUCCESS;
            }),
            "fd_pread": syscall((fd, iovsOffset, iovsLength, offset, nreadOffset)=>{
                const entry = this.#fds[fd];
                if (entry == null) {
                    return ERRNO_BADF;
                }
                const seek = Deno.seekSync(entry.rid, 0, Deno.SeekMode.Current);
                const memoryView = new DataView(this.#memory.buffer);
                let nread = 0;
                for(let i = 0; i < iovsLength; i++){
                    const dataOffset = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const dataLength = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const data = new Uint8Array(this.#memory.buffer, dataOffset, dataLength);
                    nread += Deno.readSync(entry.rid, data);
                }
                Deno.seekSync(entry.rid, seek, Deno.SeekMode.Start);
                memoryView.setUint32(nreadOffset, nread, true);
                return ERRNO_SUCCESS;
            }),
            "fd_prestat_get": syscall((fd, prestatOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.vpath) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                memoryView.setUint8(prestatOffset, PREOPENTYPE_DIR);
                memoryView.setUint32(prestatOffset + 4, new TextEncoder().encode(entry.vpath).byteLength, true);
                return ERRNO_SUCCESS;
            }),
            "fd_prestat_dir_name": syscall((fd, pathOffset, pathLength)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.vpath) {
                    return ERRNO_BADF;
                }
                const data = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                data.set(new TextEncoder().encode(entry.vpath));
                return ERRNO_SUCCESS;
            }),
            "fd_pwrite": syscall((fd, iovsOffset, iovsLength, offset, nwrittenOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const seek = Deno.seekSync(entry.rid, 0, Deno.SeekMode.Current);
                const memoryView = new DataView(this.#memory.buffer);
                let nwritten = 0;
                for(let i = 0; i < iovsLength; i++){
                    const dataOffset = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const dataLength = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const data = new Uint8Array(this.#memory.buffer, dataOffset, dataLength);
                    nwritten += Deno.writeSync(entry.rid, data);
                }
                Deno.seekSync(entry.rid, seek, Deno.SeekMode.Start);
                memoryView.setUint32(nwrittenOffset, nwritten, true);
                return ERRNO_SUCCESS;
            }),
            "fd_read": syscall((fd, iovsOffset, iovsLength, nreadOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                let nread = 0;
                for(let i = 0; i < iovsLength; i++){
                    const dataOffset = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const dataLength = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const data = new Uint8Array(this.#memory.buffer, dataOffset, dataLength);
                    nread += Deno.readSync(entry.rid, data);
                }
                memoryView.setUint32(nreadOffset, nread, true);
                return ERRNO_SUCCESS;
            }),
            "fd_readdir": syscall((fd, bufferOffset, bufferLength, cookie, bufferUsedOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryData = new Uint8Array(this.#memory.buffer);
                const memoryView = new DataView(this.#memory.buffer);
                let bufferUsed = 0;
                const entries = Array.from(Deno.readDirSync(entry.path));
                for(let i = Number(cookie); i < entries.length; i++){
                    const nameData = new TextEncoder().encode(entries[i].name);
                    const entryInfo = Deno.statSync(resolve(entry.path, entries[i].name));
                    const entryData = new Uint8Array(24 + nameData.byteLength);
                    const entryView = new DataView(entryData.buffer);
                    entryView.setBigUint64(0, BigInt(i + 1), true);
                    entryView.setBigUint64(8, BigInt(entryInfo.ino ? entryInfo.ino : 0), true);
                    entryView.setUint32(16, nameData.byteLength, true);
                    let type;
                    switch(true){
                        case entries[i].isFile:
                            type = FILETYPE_REGULAR_FILE;
                            break;
                        case entries[i].isDirectory:
                            type = FILETYPE_REGULAR_FILE;
                            break;
                        case entries[i].isSymlink:
                            type = FILETYPE_SYMBOLIC_LINK;
                            break;
                        default:
                            type = FILETYPE_REGULAR_FILE;
                            break;
                    }
                    entryView.setUint8(20, type);
                    entryData.set(nameData, 24);
                    const data = entryData.slice(0, Math.min(entryData.length, bufferLength - bufferUsed));
                    memoryData.set(data, bufferOffset + bufferUsed);
                    bufferUsed += data.byteLength;
                }
                memoryView.setUint32(bufferUsedOffset, bufferUsed, true);
                return ERRNO_SUCCESS;
            }),
            "fd_renumber": syscall((fd, to)=>{
                if (!this.#fds[fd]) {
                    return ERRNO_BADF;
                }
                if (!this.#fds[to]) {
                    return ERRNO_BADF;
                }
                if (this.#fds[to].rid) {
                    Deno.close(this.#fds[to].rid);
                }
                this.#fds[to] = this.#fds[fd];
                delete this.#fds[fd];
                return ERRNO_SUCCESS;
            }),
            "fd_seek": syscall((fd, offset, whence, newOffsetOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                // FIXME Deno does not support seeking with big integers
                const newOffset = Deno.seekSync(entry.rid, Number(offset), whence);
                memoryView.setBigUint64(newOffsetOffset, BigInt(newOffset), true);
                return ERRNO_SUCCESS;
            }),
            "fd_sync": syscall((fd)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                Deno.fsyncSync(entry.rid);
                return ERRNO_SUCCESS;
            }),
            "fd_tell": syscall((fd, offsetOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                const offset = Deno.seekSync(entry.rid, 0, Deno.SeekMode.Current);
                memoryView.setBigUint64(offsetOffset, BigInt(offset), true);
                return ERRNO_SUCCESS;
            }),
            "fd_write": syscall((fd, iovsOffset, iovsLength, nwrittenOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                const memoryView = new DataView(this.#memory.buffer);
                let nwritten = 0;
                for(let i = 0; i < iovsLength; i++){
                    const dataOffset = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const dataLength = memoryView.getUint32(iovsOffset, true);
                    iovsOffset += 4;
                    const data = new Uint8Array(this.#memory.buffer, dataOffset, dataLength);
                    nwritten += Deno.writeSync(entry.rid, data);
                }
                memoryView.setUint32(nwrittenOffset, nwritten, true);
                return ERRNO_SUCCESS;
            }),
            "path_create_directory": syscall((fd, pathOffset, pathLength)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const data = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const path = resolve(entry.path, textDecoder.decode(data));
                Deno.mkdirSync(path);
                return ERRNO_SUCCESS;
            }),
            "path_filestat_get": syscall((fd, flags, pathOffset, pathLength, bufferOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const data = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const path = resolve(entry.path, textDecoder.decode(data));
                const memoryView = new DataView(this.#memory.buffer);
                const info = (flags & LOOKUPFLAGS_SYMLINK_FOLLOW) != 0 ? Deno.statSync(path) : Deno.lstatSync(path);
                memoryView.setBigUint64(bufferOffset, BigInt(info.dev ? info.dev : 0), true);
                bufferOffset += 8;
                memoryView.setBigUint64(bufferOffset, BigInt(info.ino ? info.ino : 0), true);
                bufferOffset += 8;
                switch(true){
                    case info.isFile:
                        memoryView.setUint8(bufferOffset, FILETYPE_REGULAR_FILE);
                        bufferOffset += 8;
                        break;
                    case info.isDirectory:
                        memoryView.setUint8(bufferOffset, FILETYPE_DIRECTORY);
                        bufferOffset += 8;
                        break;
                    case info.isSymlink:
                        memoryView.setUint8(bufferOffset, FILETYPE_SYMBOLIC_LINK);
                        bufferOffset += 8;
                        break;
                    default:
                        memoryView.setUint8(bufferOffset, FILETYPE_UNKNOWN);
                        bufferOffset += 8;
                        break;
                }
                memoryView.setUint32(bufferOffset, Number(info.nlink), true);
                bufferOffset += 8;
                memoryView.setBigUint64(bufferOffset, BigInt(info.size), true);
                bufferOffset += 8;
                memoryView.setBigUint64(bufferOffset, BigInt(info.atime ? info.atime.getTime() * 1e6 : 0), true);
                bufferOffset += 8;
                memoryView.setBigUint64(bufferOffset, BigInt(info.mtime ? info.mtime.getTime() * 1e6 : 0), true);
                bufferOffset += 8;
                memoryView.setBigUint64(bufferOffset, BigInt(info.birthtime ? info.birthtime.getTime() * 1e6 : 0), true);
                bufferOffset += 8;
                return ERRNO_SUCCESS;
            }),
            "path_filestat_set_times": syscall((fd, flags, pathOffset, pathLength, atim, mtim, fstflags)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const data = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const path = resolve(entry.path, textDecoder.decode(data));
                if ((fstflags & FSTFLAGS_ATIM_NOW) == FSTFLAGS_ATIM_NOW) {
                    atim = BigInt(Date.now()) * BigInt(1e6);
                }
                if ((fstflags & FSTFLAGS_MTIM_NOW) == FSTFLAGS_MTIM_NOW) {
                    mtim = BigInt(Date.now()) * BigInt(1e6);
                }
                Deno.utimeSync(path, Number(atim), Number(mtim));
                return ERRNO_SUCCESS;
            }),
            "path_link": syscall((oldFd, oldFlags, oldPathOffset, oldPathLength, newFd, newPathOffset, newPathLength)=>{
                const oldEntry = this.#fds[oldFd];
                const newEntry = this.#fds[newFd];
                if (!oldEntry || !newEntry) {
                    return ERRNO_BADF;
                }
                if (!oldEntry.path || !newEntry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const oldData = new Uint8Array(this.#memory.buffer, oldPathOffset, oldPathLength);
                const oldPath = resolve(oldEntry.path, textDecoder.decode(oldData));
                const newData = new Uint8Array(this.#memory.buffer, newPathOffset, newPathLength);
                const newPath = resolve(newEntry.path, textDecoder.decode(newData));
                Deno.linkSync(oldPath, newPath);
                return ERRNO_SUCCESS;
            }),
            "path_open": syscall((fd, dirflags, pathOffset, pathLength, oflags, rightsBase, rightsInheriting, fdflags, openedFdOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const pathData = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const resolvedPath = resolve(entry.path, textDecoder.decode(pathData));
                if (relative(entry.path, resolvedPath).startsWith("..")) {
                    return ERRNO_NOTCAPABLE;
                }
                let path;
                if ((dirflags & LOOKUPFLAGS_SYMLINK_FOLLOW) == LOOKUPFLAGS_SYMLINK_FOLLOW) {
                    try {
                        path = Deno.realPathSync(resolvedPath);
                        if (relative(entry.path, path).startsWith("..")) {
                            return ERRNO_NOTCAPABLE;
                        }
                    } catch (_err) {
                        path = resolvedPath;
                    }
                } else {
                    path = resolvedPath;
                }
                if ((oflags & OFLAGS_DIRECTORY) !== 0) {
                    // XXX (caspervonb) this isn't ideal as we can't get a rid for the
                    // directory this way so there's no native fstat but Deno.open
                    // doesn't work with directories on windows so we'll have to work
                    // around it for now.
                    const entries = Array.from(Deno.readDirSync(path));
                    const openedFd = this.#fds.push({
                        flags: fdflags,
                        path,
                        entries
                    }) - 1;
                    const memoryView = new DataView(this.#memory.buffer);
                    memoryView.setUint32(openedFdOffset, openedFd, true);
                    return ERRNO_SUCCESS;
                }
                const options = {
                    read: false,
                    write: false,
                    append: false,
                    truncate: false,
                    create: false,
                    createNew: false
                };
                if ((oflags & OFLAGS_CREAT) !== 0) {
                    options.create = true;
                    options.write = true;
                }
                if ((oflags & OFLAGS_EXCL) !== 0) {
                    options.createNew = true;
                }
                if ((oflags & OFLAGS_TRUNC) !== 0) {
                    options.truncate = true;
                    options.write = true;
                }
                const read = RIGHTS_FD_READ | RIGHTS_FD_READDIR;
                if ((rightsBase & read) != 0n) {
                    options.read = true;
                }
                const write = RIGHTS_FD_DATASYNC | RIGHTS_FD_WRITE | RIGHTS_FD_ALLOCATE | RIGHTS_FD_FILESTAT_SET_SIZE;
                if ((rightsBase & write) != 0n) {
                    options.write = true;
                }
                if ((fdflags & FDFLAGS_APPEND) != 0) {
                    options.append = true;
                }
                if ((fdflags & FDFLAGS_DSYNC) != 0) {
                // TODO(caspervonb): review if we can emulate this.
                }
                if ((fdflags & FDFLAGS_NONBLOCK) != 0) {
                // TODO(caspervonb): review if we can emulate this.
                }
                if ((fdflags & FDFLAGS_RSYNC) != 0) {
                // TODO(caspervonb): review if we can emulate this.
                }
                if ((fdflags & FDFLAGS_SYNC) != 0) {
                // TODO(caspervonb): review if we can emulate this.
                }
                if (!options.read && !options.write && !options.truncate) {
                    options.read = true;
                }
                const { rid  } = Deno.openSync(path, options);
                const openedFd1 = this.#fds.push({
                    rid,
                    flags: fdflags,
                    path
                }) - 1;
                const memoryView1 = new DataView(this.#memory.buffer);
                memoryView1.setUint32(openedFdOffset, openedFd1, true);
                return ERRNO_SUCCESS;
            }),
            "path_readlink": syscall((fd, pathOffset, pathLength, bufferOffset, bufferLength, bufferUsedOffset)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const memoryData = new Uint8Array(this.#memory.buffer);
                const memoryView = new DataView(this.#memory.buffer);
                const pathData = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const path = resolve(entry.path, new TextDecoder().decode(pathData));
                const link = Deno.readLinkSync(path);
                const linkData = new TextEncoder().encode(link);
                memoryData.set(new Uint8Array(linkData, 0, bufferLength), bufferOffset);
                const bufferUsed = Math.min(linkData.byteLength, bufferLength);
                memoryView.setUint32(bufferUsedOffset, bufferUsed, true);
                return ERRNO_SUCCESS;
            }),
            "path_remove_directory": syscall((fd, pathOffset, pathLength)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const data = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const path = resolve(entry.path, textDecoder.decode(data));
                if (!Deno.statSync(path).isDirectory) {
                    return ERRNO_NOTDIR;
                }
                Deno.removeSync(path);
                return ERRNO_SUCCESS;
            }),
            "path_rename": syscall((fd, oldPathOffset, oldPathLength, newFd, newPathOffset, newPathLength)=>{
                const oldEntry = this.#fds[fd];
                const newEntry = this.#fds[newFd];
                if (!oldEntry || !newEntry) {
                    return ERRNO_BADF;
                }
                if (!oldEntry.path || !newEntry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const oldData = new Uint8Array(this.#memory.buffer, oldPathOffset, oldPathLength);
                const oldPath = resolve(oldEntry.path, textDecoder.decode(oldData));
                const newData = new Uint8Array(this.#memory.buffer, newPathOffset, newPathLength);
                const newPath = resolve(newEntry.path, textDecoder.decode(newData));
                Deno.renameSync(oldPath, newPath);
                return ERRNO_SUCCESS;
            }),
            "path_symlink": syscall((oldPathOffset, oldPathLength, fd, newPathOffset, newPathLength)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const oldData = new Uint8Array(this.#memory.buffer, oldPathOffset, oldPathLength);
                const oldPath = textDecoder.decode(oldData);
                const newData = new Uint8Array(this.#memory.buffer, newPathOffset, newPathLength);
                const newPath = resolve(entry.path, textDecoder.decode(newData));
                Deno.symlinkSync(oldPath, newPath);
                return ERRNO_SUCCESS;
            }),
            "path_unlink_file": syscall((fd, pathOffset, pathLength)=>{
                const entry = this.#fds[fd];
                if (!entry) {
                    return ERRNO_BADF;
                }
                if (!entry.path) {
                    return ERRNO_INVAL;
                }
                const textDecoder = new TextDecoder();
                const data = new Uint8Array(this.#memory.buffer, pathOffset, pathLength);
                const path = resolve(entry.path, textDecoder.decode(data));
                Deno.removeSync(path);
                return ERRNO_SUCCESS;
            }),
            "poll_oneoff": syscall((_inOffset, _outOffset, _nsubscriptions, _neventsOffset)=>{
                return ERRNO_NOSYS;
            }),
            "proc_exit": syscall((rval)=>{
                if (this.#exitOnReturn) {
                    Deno.exit(rval);
                }
                throw new ExitStatus(rval);
            }),
            "proc_raise": syscall((_sig)=>{
                return ERRNO_NOSYS;
            }),
            "sched_yield": syscall(()=>{
                return ERRNO_SUCCESS;
            }),
            "random_get": syscall((bufferOffset, bufferLength)=>{
                const buffer = new Uint8Array(this.#memory.buffer, bufferOffset, bufferLength);
                crypto.getRandomValues(buffer);
                return ERRNO_SUCCESS;
            }),
            "sock_recv": syscall((_fd, _riDataOffset, _riDataLength, _riFlags, _roDataLengthOffset, _roFlagsOffset)=>{
                return ERRNO_NOSYS;
            }),
            "sock_send": syscall((_fd, _siDataOffset, _siDataLength, _siFlags, _soDataLengthOffset)=>{
                return ERRNO_NOSYS;
            }),
            "sock_shutdown": syscall((_fd, _how)=>{
                return ERRNO_NOSYS;
            })
        };
        this.#started = false;
    }
    /**
   * Attempt to begin execution of instance as a command by invoking its
   * _start() export.
   *
   * If the instance does not contain a _start() export, or if the instance
   * contains an _initialize export an error will be thrown.
   *
   * The instance must also have a WebAssembly.Memory export named "memory"
   * which will be used as the address space, if it does not an error will be
   * thrown.
   */ start(instance) {
        if (this.#started) {
            throw new Error("WebAssembly.Instance has already started");
        }
        this.#started = true;
        const { _start , _initialize , memory  } = instance.exports;
        if (!(memory instanceof WebAssembly.Memory)) {
            throw new TypeError("WebAsembly.instance must provide a memory export");
        }
        this.#memory = memory;
        if (typeof _initialize == "function") {
            throw new TypeError("WebAsembly.instance export _initialize must not be a function");
        }
        if (typeof _start != "function") {
            throw new TypeError("WebAssembly.Instance export _start must be a function");
        }
        try {
            _start();
        } catch (err) {
            if (err instanceof ExitStatus) {
                return err.code;
            }
            throw err;
        }
        return null;
    }
    /**
   * Attempt to initialize instance as a reactor by invoking its _initialize() export.
   *
   * If instance contains a _start() export, then an exception is thrown.
   *
   * The instance must also have a WebAssembly.Memory export named "memory"
   * which will be used as the address space, if it does not an error will be
   * thrown.
   */ initialize(instance) {
        if (this.#started) {
            throw new Error("WebAssembly.Instance has already started");
        }
        this.#started = true;
        const { _start , _initialize , memory  } = instance.exports;
        if (!(memory instanceof WebAssembly.Memory)) {
            throw new TypeError("WebAsembly.instance must provide a memory export");
        }
        this.#memory = memory;
        if (typeof _start == "function") {
            throw new TypeError("WebAssembly.Instance export _start must not be a function");
        }
        if (_initialize && typeof _initialize != "function") {
            throw new TypeError("WebAssembly.Instance export _initialize must be a function or not be defined");
        }
        _initialize?.();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE2Ny4wL3dhc2kvc25hcHNob3RfcHJldmlldzEudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby11bnVzZWQtdmFyc1xuXG4vKipcbiAqIFByb3ZpZGVzIGFuIGltcGxlbWVudGF0aW9uIG9mIHRoZVxuICogW1dlYkFzc2VtYmx5IFN5c3RlbSBJbnRlcmZhY2VdKGh0dHBzOi8vd2FzaS5kZXYvKS5cbiAqXG4gKiAjIyBTdXBwb3J0ZWQgU3lzY2FsbHNcbiAqIC0gW3hdIGFyZ3NfZ2V0XG4gKiAtIFt4XSBhcmdzX3NpemVzX2dldFxuICogLSBbeF0gZW52aXJvbl9nZXRcbiAqIC0gW3hdIGVudmlyb25fc2l6ZXNfZ2V0XG4gKiAtIFt4XSBjbG9ja19yZXNfZ2V0XG4gKiAtIFt4XSBjbG9ja190aW1lX2dldFxuICogLSBbIF0gZmRfYWR2aXNlXG4gKiAtIFsgXSBmZF9hbGxvY2F0ZVxuICogLSBbeF0gZmRfY2xvc2VcbiAqIC0gW3hdIGZkX2RhdGFzeW5jXG4gKiAtIFt4XSBmZF9mZHN0YXRfZ2V0XG4gKiAtIFsgXSBmZF9mZHN0YXRfc2V0X2ZsYWdzXG4gKiAtIFsgXSBmZF9mZHN0YXRfc2V0X3JpZ2h0c1xuICogLSBbeF0gZmRfZmlsZXN0YXRfZ2V0XG4gKiAtIFt4XSBmZF9maWxlc3RhdF9zZXRfc2l6ZVxuICogLSBbeF0gZmRfZmlsZXN0YXRfc2V0X3RpbWVzXG4gKiAtIFt4XSBmZF9wcmVhZFxuICogLSBbeF0gZmRfcHJlc3RhdF9nZXRcbiAqIC0gW3hdIGZkX3ByZXN0YXRfZGlyX25hbWVcbiAqIC0gW3hdIGZkX3B3cml0ZVxuICogLSBbeF0gZmRfcmVhZFxuICogLSBbeF0gZmRfcmVhZGRpclxuICogLSBbeF0gZmRfcmVudW1iZXJcbiAqIC0gW3hdIGZkX3NlZWtcbiAqIC0gW3hdIGZkX3N5bmNcbiAqIC0gW3hdIGZkX3RlbGxcbiAqIC0gW3hdIGZkX3dyaXRlXG4gKiAtIFt4XSBwYXRoX2NyZWF0ZV9kaXJlY3RvcnlcbiAqIC0gW3hdIHBhdGhfZmlsZXN0YXRfZ2V0XG4gKiAtIFt4XSBwYXRoX2ZpbGVzdGF0X3NldF90aW1lc1xuICogLSBbeF0gcGF0aF9saW5rXG4gKiAtIFt4XSBwYXRoX29wZW5cbiAqIC0gW3hdIHBhdGhfcmVhZGxpbmtcbiAqIC0gW3hdIHBhdGhfcmVtb3ZlX2RpcmVjdG9yeVxuICogLSBbeF0gcGF0aF9yZW5hbWVcbiAqIC0gW3hdIHBhdGhfc3ltbGlua1xuICogLSBbeF0gcGF0aF91bmxpbmtfZmlsZVxuICogLSBbeF0gcG9sbF9vbmVvZmZcbiAqIC0gW3hdIHByb2NfZXhpdFxuICogLSBbIF0gcHJvY19yYWlzZVxuICogLSBbeF0gc2NoZWRfeWllbGRcbiAqIC0gW3hdIHJhbmRvbV9nZXRcbiAqIC0gWyBdIHNvY2tfcmVjdlxuICogLSBbIF0gc29ja19zZW5kXG4gKiAtIFsgXSBzb2NrX3NodXRkb3duXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiBpbXBvcnQgQ29udGV4dCBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi93YXNpL3NuYXBzaG90X3ByZXZpZXcxLnRzXCI7XG4gKlxuICogY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0KHtcbiAqICAgYXJnczogRGVuby5hcmdzLFxuICogICBlbnY6IERlbm8uZW52LnRvT2JqZWN0KCksXG4gKiB9KTtcbiAqXG4gKiBjb25zdCBiaW5hcnkgPSBhd2FpdCBEZW5vLnJlYWRGaWxlKFwicGF0aC90by95b3VyL21vZHVsZS53YXNtXCIpO1xuICogY29uc3QgbW9kdWxlID0gYXdhaXQgV2ViQXNzZW1ibHkuY29tcGlsZShiaW5hcnkpO1xuICogY29uc3QgaW5zdGFuY2UgPSBhd2FpdCBXZWJBc3NlbWJseS5pbnN0YW50aWF0ZShtb2R1bGUsIHtcbiAqICAgXCJ3YXNpX3NuYXBzaG90X3ByZXZpZXcxXCI6IGNvbnRleHQuZXhwb3J0cyxcbiAqIH0pO1xuICpcbiAqIGNvbnRleHQuc3RhcnQoaW5zdGFuY2UpO1xuICogYGBgXG4gKlxuICogQG1vZHVsZVxuICovXG5cbmltcG9ydCB7IHJlbGF0aXZlLCByZXNvbHZlIH0gZnJvbSBcIi4uL3BhdGgvbW9kLnRzXCI7XG5cbmNvbnN0IENMT0NLSURfUkVBTFRJTUUgPSAwO1xuY29uc3QgQ0xPQ0tJRF9NT05PVE9OSUMgPSAxO1xuY29uc3QgQ0xPQ0tJRF9QUk9DRVNTX0NQVVRJTUVfSUQgPSAyO1xuY29uc3QgQ0xPQ0tJRF9USFJFQURfQ1BVVElNRV9JRCA9IDM7XG5cbmNvbnN0IEVSUk5PX1NVQ0NFU1MgPSAwO1xuY29uc3QgX0VSUk5PXzJCSUcgPSAxO1xuY29uc3QgRVJSTk9fQUNDRVMgPSAyO1xuY29uc3QgRVJSTk9fQUREUklOVVNFID0gMztcbmNvbnN0IEVSUk5PX0FERFJOT1RBVkFJTCA9IDQ7XG5jb25zdCBfRVJSTk9fQUZOT1NVUFBPUlQgPSA1O1xuY29uc3QgX0VSUk5PX0FHQUlOID0gNjtcbmNvbnN0IF9FUlJOT19BTFJFQURZID0gNztcbmNvbnN0IEVSUk5PX0JBREYgPSA4O1xuY29uc3QgX0VSUk5PX0JBRE1TRyA9IDk7XG5jb25zdCBFUlJOT19CVVNZID0gMTA7XG5jb25zdCBfRVJSTk9fQ0FOQ0VMRUQgPSAxMTtcbmNvbnN0IF9FUlJOT19DSElMRCA9IDEyO1xuY29uc3QgRVJSTk9fQ09OTkFCT1JURUQgPSAxMztcbmNvbnN0IEVSUk5PX0NPTk5SRUZVU0VEID0gMTQ7XG5jb25zdCBFUlJOT19DT05OUkVTRVQgPSAxNTtcbmNvbnN0IF9FUlJOT19ERUFETEsgPSAxNjtcbmNvbnN0IF9FUlJOT19ERVNUQUREUlJFUSA9IDE3O1xuY29uc3QgX0VSUk5PX0RPTSA9IDE4O1xuY29uc3QgX0VSUk5PX0RRVU9UID0gMTk7XG5jb25zdCBfRVJSTk9fRVhJU1QgPSAyMDtcbmNvbnN0IF9FUlJOT19GQVVMVCA9IDIxO1xuY29uc3QgX0VSUk5PX0ZCSUcgPSAyMjtcbmNvbnN0IF9FUlJOT19IT1NUVU5SRUFDSCA9IDIzO1xuY29uc3QgX0VSUk5PX0lEUk0gPSAyNDtcbmNvbnN0IF9FUlJOT19JTFNFUSA9IDI1O1xuY29uc3QgX0VSUk5PX0lOUFJPR1JFU1MgPSAyNjtcbmNvbnN0IEVSUk5PX0lOVFIgPSAyNztcbmNvbnN0IEVSUk5PX0lOVkFMID0gMjg7XG5jb25zdCBfRVJSTk9fSU8gPSAyOTtcbmNvbnN0IF9FUlJOT19JU0NPTk4gPSAzMDtcbmNvbnN0IF9FUlJOT19JU0RJUiA9IDMxO1xuY29uc3QgX0VSUk5PX0xPT1AgPSAzMjtcbmNvbnN0IF9FUlJOT19NRklMRSA9IDMzO1xuY29uc3QgX0VSUk5PX01MSU5LID0gMzQ7XG5jb25zdCBfRVJSTk9fTVNHU0laRSA9IDM1O1xuY29uc3QgX0VSUk5PX01VTFRJSE9QID0gMzY7XG5jb25zdCBfRVJSTk9fTkFNRVRPT0xPTkcgPSAzNztcbmNvbnN0IF9FUlJOT19ORVRET1dOID0gMzg7XG5jb25zdCBfRVJSTk9fTkVUUkVTRVQgPSAzOTtcbmNvbnN0IF9FUlJOT19ORVRVTlJFQUNIID0gNDA7XG5jb25zdCBfRVJSTk9fTkZJTEUgPSA0MTtcbmNvbnN0IF9FUlJOT19OT0JVRlMgPSA0MjtcbmNvbnN0IF9FUlJOT19OT0RFViA9IDQzO1xuY29uc3QgRVJSTk9fTk9FTlQgPSA0NDtcbmNvbnN0IF9FUlJOT19OT0VYRUMgPSA0NTtcbmNvbnN0IF9FUlJOT19OT0xDSyA9IDQ2O1xuY29uc3QgX0VSUk5PX05PTElOSyA9IDQ3O1xuY29uc3QgX0VSUk5PX05PTUVNID0gNDg7XG5jb25zdCBfRVJSTk9fTk9NU0cgPSA0OTtcbmNvbnN0IF9FUlJOT19OT1BST1RPT1BUID0gNTA7XG5jb25zdCBfRVJSTk9fTk9TUEMgPSA1MTtcbmNvbnN0IEVSUk5PX05PU1lTID0gNTI7XG5jb25zdCBFUlJOT19OT1RDT05OID0gNTM7XG5jb25zdCBFUlJOT19OT1RESVIgPSA1NDtcbmNvbnN0IF9FUlJOT19OT1RFTVBUWSA9IDU1O1xuY29uc3QgX0VSUk5PX05PVFJFQ09WRVJBQkxFID0gNTY7XG5jb25zdCBfRVJSTk9fTk9UU09DSyA9IDU3O1xuY29uc3QgX0VSUk5PX05PVFNVUCA9IDU4O1xuY29uc3QgX0VSUk5PX05PVFRZID0gNTk7XG5jb25zdCBfRVJSTk9fTlhJTyA9IDYwO1xuY29uc3QgX0VSUk5PX09WRVJGTE9XID0gNjE7XG5jb25zdCBfRVJSTk9fT1dORVJERUFEID0gNjI7XG5jb25zdCBfRVJSTk9fUEVSTSA9IDYzO1xuY29uc3QgRVJSTk9fUElQRSA9IDY0O1xuY29uc3QgX0VSUk5PX1BST1RPID0gNjU7XG5jb25zdCBfRVJSTk9fUFJPVE9OT1NVUFBPUlQgPSA2NjtcbmNvbnN0IF9FUlJOT19QUk9UT1RZUEUgPSA2NztcbmNvbnN0IF9FUlJOT19SQU5HRSA9IDY4O1xuY29uc3QgX0VSUk5PX1JPRlMgPSA2OTtcbmNvbnN0IF9FUlJOT19TUElQRSA9IDcwO1xuY29uc3QgX0VSUk5PX1NSQ0ggPSA3MTtcbmNvbnN0IF9FUlJOT19TVEFMRSA9IDcyO1xuY29uc3QgRVJSTk9fVElNRURPVVQgPSA3MztcbmNvbnN0IF9FUlJOT19UWFRCU1kgPSA3NDtcbmNvbnN0IF9FUlJOT19YREVWID0gNzU7XG5jb25zdCBFUlJOT19OT1RDQVBBQkxFID0gNzY7XG5cbmNvbnN0IFJJR0hUU19GRF9EQVRBU1lOQyA9IDB4MDAwMDAwMDAwMDAwMDAwMW47XG5jb25zdCBSSUdIVFNfRkRfUkVBRCA9IDB4MDAwMDAwMDAwMDAwMDAwMm47XG5jb25zdCBfUklHSFRTX0ZEX1NFRUsgPSAweDAwMDAwMDAwMDAwMDAwMDRuO1xuY29uc3QgX1JJR0hUU19GRF9GRFNUQVRfU0VUX0ZMQUdTID0gMHgwMDAwMDAwMDAwMDAwMDA4bjtcbmNvbnN0IF9SSUdIVFNfRkRfU1lOQyA9IDB4MDAwMDAwMDAwMDAwMDAxMG47XG5jb25zdCBfUklHSFRTX0ZEX1RFTEwgPSAweDAwMDAwMDAwMDAwMDAwMjBuO1xuY29uc3QgUklHSFRTX0ZEX1dSSVRFID0gMHgwMDAwMDAwMDAwMDAwMDQwbjtcbmNvbnN0IF9SSUdIVFNfRkRfQURWSVNFID0gMHgwMDAwMDAwMDAwMDAwMDgwbjtcbmNvbnN0IFJJR0hUU19GRF9BTExPQ0FURSA9IDB4MDAwMDAwMDAwMDAwMDEwMG47XG5jb25zdCBfUklHSFRTX1BBVEhfQ1JFQVRFX0RJUkVDVE9SWSA9IDB4MDAwMDAwMDAwMDAwMDIwMG47XG5jb25zdCBfUklHSFRTX1BBVEhfQ1JFQVRFX0ZJTEUgPSAweDAwMDAwMDAwMDAwMDA0MDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX0xJTktfU09VUkNFID0gMHgwMDAwMDAwMDAwMDAwODAwbjtcbmNvbnN0IF9SSUdIVFNfUEFUSF9MSU5LX1RBUkdFVCA9IDB4MDAwMDAwMDAwMDAwMTAwMG47XG5jb25zdCBfUklHSFRTX1BBVEhfT1BFTiA9IDB4MDAwMDAwMDAwMDAwMjAwMG47XG5jb25zdCBSSUdIVFNfRkRfUkVBRERJUiA9IDB4MDAwMDAwMDAwMDAwNDAwMG47XG5jb25zdCBfUklHSFRTX1BBVEhfUkVBRExJTksgPSAweDAwMDAwMDAwMDAwMDgwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX1JFTkFNRV9TT1VSQ0UgPSAweDAwMDAwMDAwMDAwMTAwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX1JFTkFNRV9UQVJHRVQgPSAweDAwMDAwMDAwMDAwMjAwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX0ZJTEVTVEFUX0dFVCA9IDB4MDAwMDAwMDAwMDA0MDAwMG47XG5jb25zdCBfUklHSFRTX1BBVEhfRklMRVNUQVRfU0VUX1NJWkUgPSAweDAwMDAwMDAwMDAwODAwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX0ZJTEVTVEFUX1NFVF9USU1FUyA9IDB4MDAwMDAwMDAwMDEwMDAwMG47XG5jb25zdCBfUklHSFRTX0ZEX0ZJTEVTVEFUX0dFVCA9IDB4MDAwMDAwMDAwMDIwMDAwMG47XG5jb25zdCBSSUdIVFNfRkRfRklMRVNUQVRfU0VUX1NJWkUgPSAweDAwMDAwMDAwMDA0MDAwMDBuO1xuY29uc3QgX1JJR0hUU19GRF9GSUxFU1RBVF9TRVRfVElNRVMgPSAweDAwMDAwMDAwMDA4MDAwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX1NZTUxJTksgPSAweDAwMDAwMDAwMDEwMDAwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX1JFTU9WRV9ESVJFQ1RPUlkgPSAweDAwMDAwMDAwMDIwMDAwMDBuO1xuY29uc3QgX1JJR0hUU19QQVRIX1VOTElOS19GSUxFID0gMHgwMDAwMDAwMDA0MDAwMDAwbjtcbmNvbnN0IF9SSUdIVFNfUE9MTF9GRF9SRUFEV1JJVEUgPSAweDAwMDAwMDAwMDgwMDAwMDBuO1xuY29uc3QgX1JJR0hUU19TT0NLX1NIVVRET1dOID0gMHgwMDAwMDAwMDEwMDAwMDAwbjtcblxuY29uc3QgX1dIRU5DRV9TRVQgPSAwO1xuY29uc3QgX1dIRU5DRV9DVVIgPSAxO1xuY29uc3QgX1dIRU5DRV9FTkQgPSAyO1xuXG5jb25zdCBGSUxFVFlQRV9VTktOT1dOID0gMDtcbmNvbnN0IF9GSUxFVFlQRV9CTE9DS19ERVZJQ0UgPSAxO1xuY29uc3QgRklMRVRZUEVfQ0hBUkFDVEVSX0RFVklDRSA9IDI7XG5jb25zdCBGSUxFVFlQRV9ESVJFQ1RPUlkgPSAzO1xuY29uc3QgRklMRVRZUEVfUkVHVUxBUl9GSUxFID0gNDtcbmNvbnN0IF9GSUxFVFlQRV9TT0NLRVRfREdSQU0gPSA1O1xuY29uc3QgX0ZJTEVUWVBFX1NPQ0tFVF9TVFJFQU0gPSA2O1xuY29uc3QgRklMRVRZUEVfU1lNQk9MSUNfTElOSyA9IDc7XG5cbmNvbnN0IF9BRFZJQ0VfTk9STUFMID0gMDtcbmNvbnN0IF9BRFZJQ0VfU0VRVUVOVElBTCA9IDE7XG5jb25zdCBfQURWSUNFX1JBTkRPTSA9IDI7XG5jb25zdCBfQURWSUNFX1dJTExORUVEID0gMztcbmNvbnN0IF9BRFZJQ0VfRE9OVE5FRUQgPSA0O1xuY29uc3QgX0FEVklDRV9OT1JFVVNFID0gNTtcblxuY29uc3QgRkRGTEFHU19BUFBFTkQgPSAweDAwMDE7XG5jb25zdCBGREZMQUdTX0RTWU5DID0gMHgwMDAyO1xuY29uc3QgRkRGTEFHU19OT05CTE9DSyA9IDB4MDAwNDtcbmNvbnN0IEZERkxBR1NfUlNZTkMgPSAweDAwMDg7XG5jb25zdCBGREZMQUdTX1NZTkMgPSAweDAwMTA7XG5cbmNvbnN0IF9GU1RGTEFHU19BVElNID0gMHgwMDAxO1xuY29uc3QgRlNURkxBR1NfQVRJTV9OT1cgPSAweDAwMDI7XG5jb25zdCBfRlNURkxBR1NfTVRJTSA9IDB4MDAwNDtcbmNvbnN0IEZTVEZMQUdTX01USU1fTk9XID0gMHgwMDA4O1xuXG5jb25zdCBMT09LVVBGTEFHU19TWU1MSU5LX0ZPTExPVyA9IDB4MDAwMTtcblxuY29uc3QgT0ZMQUdTX0NSRUFUID0gMHgwMDAxO1xuY29uc3QgT0ZMQUdTX0RJUkVDVE9SWSA9IDB4MDAwMjtcbmNvbnN0IE9GTEFHU19FWENMID0gMHgwMDA0O1xuY29uc3QgT0ZMQUdTX1RSVU5DID0gMHgwMDA4O1xuXG5jb25zdCBfRVZFTlRUWVBFX0NMT0NLID0gMDtcbmNvbnN0IF9FVkVOVFRZUEVfRkRfUkVBRCA9IDE7XG5jb25zdCBfRVZFTlRUWVBFX0ZEX1dSSVRFID0gMjtcblxuY29uc3QgX0VWRU5UUldGTEFHU19GRF9SRUFEV1JJVEVfSEFOR1VQID0gMTtcbmNvbnN0IF9TVUJDTE9DS0ZMQUdTX1NVQlNDUklQVElPTl9DTE9DS19BQlNUSU1FID0gMTtcblxuY29uc3QgX1NJR05BTF9OT05FID0gMDtcbmNvbnN0IF9TSUdOQUxfSFVQID0gMTtcbmNvbnN0IF9TSUdOQUxfSU5UID0gMjtcbmNvbnN0IF9TSUdOQUxfUVVJVCA9IDM7XG5jb25zdCBfU0lHTkFMX0lMTCA9IDQ7XG5jb25zdCBfU0lHTkFMX1RSQVAgPSA1O1xuY29uc3QgX1NJR05BTF9BQlJUID0gNjtcbmNvbnN0IF9TSUdOQUxfQlVTID0gNztcbmNvbnN0IF9TSUdOQUxfRlBFID0gODtcbmNvbnN0IF9TSUdOQUxfS0lMTCA9IDk7XG5jb25zdCBfU0lHTkFMX1VTUjEgPSAxMDtcbmNvbnN0IF9TSUdOQUxfU0VHViA9IDExO1xuY29uc3QgX1NJR05BTF9VU1IyID0gMTI7XG5jb25zdCBfU0lHTkFMX1BJUEUgPSAxMztcbmNvbnN0IF9TSUdOQUxfQUxSTSA9IDE0O1xuY29uc3QgX1NJR05BTF9URVJNID0gMTU7XG5jb25zdCBfU0lHTkFMX0NITEQgPSAxNjtcbmNvbnN0IF9TSUdOQUxfQ09OVCA9IDE3O1xuY29uc3QgX1NJR05BTF9TVE9QID0gMTg7XG5jb25zdCBfU0lHTkFMX1RTVFAgPSAxOTtcbmNvbnN0IF9TSUdOQUxfVFRJTiA9IDIwO1xuY29uc3QgX1NJR05BTF9UVE9VID0gMjE7XG5jb25zdCBfU0lHTkFMX1VSRyA9IDIyO1xuY29uc3QgX1NJR05BTF9YQ1BVID0gMjM7XG5jb25zdCBfU0lHTkFMX1hGU1ogPSAyNDtcbmNvbnN0IF9TSUdOQUxfVlRBTFJNID0gMjU7XG5jb25zdCBfU0lHTkFMX1BST0YgPSAyNjtcbmNvbnN0IF9TSUdOQUxfV0lOQ0ggPSAyNztcbmNvbnN0IF9TSUdOQUxfUE9MTCA9IDI4O1xuY29uc3QgX1NJR05BTF9QV1IgPSAyOTtcbmNvbnN0IF9TSUdOQUxfU1lTID0gMzA7XG5cbmNvbnN0IF9SSUZMQUdTX1JFQ1ZfUEVFSyA9IDB4MDAwMTtcbmNvbnN0IF9SSUZMQUdTX1JFQ1ZfV0FJVEFMTCA9IDB4MDAwMjtcblxuY29uc3QgX1JPRkxBR1NfUkVDVl9EQVRBX1RSVU5DQVRFRCA9IDB4MDAwMTtcblxuY29uc3QgX1NERkxBR1NfUkQgPSAweDAwMDE7XG5jb25zdCBfU0RGTEFHU19XUiA9IDB4MDAwMjtcblxuY29uc3QgUFJFT1BFTlRZUEVfRElSID0gMDtcblxuZnVuY3Rpb24gc3lzY2FsbDxUIGV4dGVuZHMgQ2FsbGFibGVGdW5jdGlvbj4odGFyZ2V0OiBUKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoLi4uYXJnczogdW5rbm93bltdKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0YXJnZXQoLi4uYXJncyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXhpdFN0YXR1cykge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG5cbiAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIEVycm9yKSkge1xuICAgICAgICByZXR1cm4gRVJSTk9fSU5WQUw7XG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAoZXJyLm5hbWUpIHtcbiAgICAgICAgY2FzZSBcIk5vdEZvdW5kXCI6XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX05PRU5UO1xuXG4gICAgICAgIGNhc2UgXCJQZXJtaXNzaW9uRGVuaWVkXCI6XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0FDQ0VTO1xuXG4gICAgICAgIGNhc2UgXCJDb25uZWN0aW9uUmVmdXNlZFwiOlxuICAgICAgICAgIHJldHVybiBFUlJOT19DT05OUkVGVVNFRDtcblxuICAgICAgICBjYXNlIFwiQ29ubmVjdGlvblJlc2V0XCI6XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0NPTk5SRVNFVDtcblxuICAgICAgICBjYXNlIFwiQ29ubmVjdGlvbkFib3J0ZWRcIjpcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQ09OTkFCT1JURUQ7XG5cbiAgICAgICAgY2FzZSBcIk5vdENvbm5lY3RlZFwiOlxuICAgICAgICAgIHJldHVybiBFUlJOT19OT1RDT05OO1xuXG4gICAgICAgIGNhc2UgXCJBZGRySW5Vc2VcIjpcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQUREUklOVVNFO1xuXG4gICAgICAgIGNhc2UgXCJBZGRyTm90QXZhaWxhYmxlXCI6XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0FERFJOT1RBVkFJTDtcblxuICAgICAgICBjYXNlIFwiQnJva2VuUGlwZVwiOlxuICAgICAgICAgIHJldHVybiBFUlJOT19QSVBFO1xuXG4gICAgICAgIGNhc2UgXCJJbnZhbGlkRGF0YVwiOlxuICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcblxuICAgICAgICBjYXNlIFwiVGltZWRPdXRcIjpcbiAgICAgICAgICByZXR1cm4gRVJSTk9fVElNRURPVVQ7XG5cbiAgICAgICAgY2FzZSBcIkludGVycnVwdGVkXCI6XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0lOVFI7XG5cbiAgICAgICAgY2FzZSBcIkJhZFJlc291cmNlXCI6XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG5cbiAgICAgICAgY2FzZSBcIkJ1c3lcIjpcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQlVTWTtcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbmludGVyZmFjZSBGaWxlRGVzY3JpcHRvciB7XG4gIHJpZD86IG51bWJlcjtcbiAgdHlwZT86IG51bWJlcjtcbiAgZmxhZ3M/OiBudW1iZXI7XG4gIHBhdGg/OiBzdHJpbmc7XG4gIHZwYXRoPzogc3RyaW5nO1xuICBlbnRyaWVzPzogRGVuby5EaXJFbnRyeVtdO1xufVxuXG5jbGFzcyBFeGl0U3RhdHVzIHtcbiAgY29kZTogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKGNvZGU6IG51bWJlcikge1xuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb250ZXh0T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBBbiBhcnJheSBvZiBzdHJpbmdzIHRoYXQgdGhlIFdlYkFzc2VtYmx5IGluc3RhbmNlIHdpbGwgc2VlIGFzIGNvbW1hbmQtbGluZVxuICAgKiBhcmd1bWVudHMuXG4gICAqXG4gICAqIFRoZSBmaXJzdCBhcmd1bWVudCBpcyB0aGUgdmlydHVhbCBwYXRoIHRvIHRoZSBjb21tYW5kIGl0c2VsZi5cbiAgICovXG4gIGFyZ3M/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW4gb2JqZWN0IG9mIHN0cmluZyBrZXlzIG1hcHBlZCB0byBzdHJpbmcgdmFsdWVzIHRoYXQgdGhlIFdlYkFzc2VtYmx5IG1vZHVsZSB3aWxsIHNlZSBhcyBpdHMgZW52aXJvbm1lbnQuXG4gICAqL1xuICBlbnY/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXG4gIC8qKlxuICAgKiBBbiBvYmplY3Qgb2Ygc3RyaW5nIGtleXMgbWFwcGVkIHRvIHN0cmluZyB2YWx1ZXMgdGhhdCB0aGUgV2ViQXNzZW1ibHkgbW9kdWxlIHdpbGwgc2VlIGFzIGl0J3MgZmlsZXN5c3RlbS5cbiAgICpcbiAgICogVGhlIHN0cmluZyBrZXlzIG9mIGFyZSB0cmVhdGVkIGFzIGRpcmVjdG9yaWVzIHdpdGhpbiB0aGUgc2FuZGJveGVkXG4gICAqIGZpbGVzeXN0ZW0sIHRoZSB2YWx1ZXMgYXJlIHRoZSByZWFsIHBhdGhzIHRvIHRob3NlIGRpcmVjdG9yaWVzIG9uIHRoZSBob3N0XG4gICAqIG1hY2hpbmUuXG4gICAqL1xuICBwcmVvcGVucz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgaWYgY2FsbHMgdG8gZXhpdCBmcm9tIHdpdGhpbiB0aGUgV2ViQXNzZW1ibHkgbW9kdWxlIHdpbGwgdGVybWluYXRlIHRoZSBwcm9lc3Mgb3IgcmV0dXJuLlxuICAgKi9cbiAgZXhpdE9uUmV0dXJuPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIHJlc291cmNlIGRlc2NyaXB0b3IgdXNlZCBhcyBzdGFuZGFyZCBpbnB1dCBpbiB0aGUgV2ViQXNzZW1ibHkgbW9kdWxlLlxuICAgKi9cbiAgc3RkaW4/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRoZSByZXNvdXJjZSBkZXNjcmlwdG9yIHVzZWQgYXMgc3RhbmRhcmQgb3V0cHV0IGluIHRoZSBXZWJBc3NlbWJseSBtb2R1bGUuXG4gICAqL1xuICBzdGRvdXQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRoZSByZXNvdXJjZSBkZXNjcmlwdG9yIHVzZWQgYXMgc3RhbmRhcmQgZXJyb3IgaW4gdGhlIFdlYkFzc2VtYmx5IG1vZHVsZS5cbiAgICovXG4gIHN0ZGVycj86IG51bWJlcjtcbn1cblxuLyoqXG4gKiBUaGUgQ29udGV4dCBjbGFzcyBwcm92aWRlcyB0aGUgZW52aXJvbm1lbnQgcmVxdWlyZWQgdG8gcnVuIFdlYkFzc2VtYmx5XG4gKiBtb2R1bGVzIGNvbXBpbGVkIHRvIHJ1biB3aXRoIHRoZSBXZWJBc3NlbWJseSBTeXN0ZW0gSW50ZXJmYWNlLlxuICpcbiAqIEVhY2ggY29udGV4dCByZXByZXNlbnRzIGEgZGlzdGluY3Qgc2FuZGJveGVkIGVudmlyb25tZW50IGFuZCBtdXN0IGhhdmUgaXRzXG4gKiBjb21tYW5kLWxpbmUgYXJndW1lbnRzLCBlbnZpcm9ubWVudCB2YXJpYWJsZXMsIGFuZCBwcmUtb3BlbmVkIGRpcmVjdG9yeVxuICogc3RydWN0dXJlIGNvbmZpZ3VyZWQgZXhwbGljaXRseS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29udGV4dCB7XG4gICNhcmdzOiBzdHJpbmdbXTtcbiAgI2VudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQgfTtcbiAgI2V4aXRPblJldHVybjogYm9vbGVhbjtcbiAgI21lbW9yeTogV2ViQXNzZW1ibHkuTWVtb3J5O1xuICAjZmRzOiBGaWxlRGVzY3JpcHRvcltdO1xuICAjc3RhcnRlZDogYm9vbGVhbjtcblxuICBleHBvcnRzOiBSZWNvcmQ8c3RyaW5nLCBXZWJBc3NlbWJseS5JbXBvcnRWYWx1ZT47XG5cbiAgY29uc3RydWN0b3Iob3B0aW9uczogQ29udGV4dE9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMuI2FyZ3MgPSBvcHRpb25zLmFyZ3MgPz8gW107XG4gICAgdGhpcy4jZW52ID0gb3B0aW9ucy5lbnYgPz8ge307XG4gICAgdGhpcy4jZXhpdE9uUmV0dXJuID0gb3B0aW9ucy5leGl0T25SZXR1cm4gPz8gdHJ1ZTtcbiAgICB0aGlzLiNtZW1vcnkgPSBudWxsITtcblxuICAgIHRoaXMuI2ZkcyA9IFtcbiAgICAgIHtcbiAgICAgICAgcmlkOiBvcHRpb25zLnN0ZGluID8/IERlbm8uc3RkaW4ucmlkLFxuICAgICAgICB0eXBlOiBGSUxFVFlQRV9DSEFSQUNURVJfREVWSUNFLFxuICAgICAgICBmbGFnczogRkRGTEFHU19BUFBFTkQsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICByaWQ6IG9wdGlvbnMuc3Rkb3V0ID8/IERlbm8uc3Rkb3V0LnJpZCxcbiAgICAgICAgdHlwZTogRklMRVRZUEVfQ0hBUkFDVEVSX0RFVklDRSxcbiAgICAgICAgZmxhZ3M6IEZERkxBR1NfQVBQRU5ELFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcmlkOiBvcHRpb25zLnN0ZGVyciA/PyBEZW5vLnN0ZGVyci5yaWQsXG4gICAgICAgIHR5cGU6IEZJTEVUWVBFX0NIQVJBQ1RFUl9ERVZJQ0UsXG4gICAgICAgIGZsYWdzOiBGREZMQUdTX0FQUEVORCxcbiAgICAgIH0sXG4gICAgXTtcblxuICAgIGlmIChvcHRpb25zLnByZW9wZW5zKSB7XG4gICAgICBmb3IgKGNvbnN0IFt2cGF0aCwgcGF0aF0gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5wcmVvcGVucykpIHtcbiAgICAgICAgY29uc3QgdHlwZSA9IEZJTEVUWVBFX0RJUkVDVE9SWTtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20oRGVuby5yZWFkRGlyU3luYyhwYXRoKSk7XG5cbiAgICAgICAgY29uc3QgZW50cnkgPSB7XG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICBlbnRyaWVzLFxuICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgdnBhdGgsXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy4jZmRzLnB1c2goZW50cnkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZXhwb3J0cyA9IHtcbiAgICAgIFwiYXJnc19nZXRcIjogc3lzY2FsbCgoXG4gICAgICAgIGFyZ3ZPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgYXJndkJ1ZmZlck9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgYXJncyA9IHRoaXMuI2FyZ3M7XG4gICAgICAgIGNvbnN0IHRleHRFbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICAgICAgIGNvbnN0IG1lbW9yeURhdGEgPSBuZXcgVWludDhBcnJheSh0aGlzLiNtZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgY29uc3QgbWVtb3J5VmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLiNtZW1vcnkuYnVmZmVyKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGFyZyBvZiBhcmdzKSB7XG4gICAgICAgICAgbWVtb3J5Vmlldy5zZXRVaW50MzIoYXJndk9mZnNldCwgYXJndkJ1ZmZlck9mZnNldCwgdHJ1ZSk7XG4gICAgICAgICAgYXJndk9mZnNldCArPSA0O1xuXG4gICAgICAgICAgY29uc3QgZGF0YSA9IHRleHRFbmNvZGVyLmVuY29kZShgJHthcmd9XFwwYCk7XG4gICAgICAgICAgbWVtb3J5RGF0YS5zZXQoZGF0YSwgYXJndkJ1ZmZlck9mZnNldCk7XG4gICAgICAgICAgYXJndkJ1ZmZlck9mZnNldCArPSBkYXRhLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwiYXJnc19zaXplc19nZXRcIjogc3lzY2FsbCgoXG4gICAgICAgIGFyZ2NPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgYXJndkJ1ZmZlclNpemVPZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLiNhcmdzO1xuICAgICAgICBjb25zdCB0ZXh0RW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKGFyZ2NPZmZzZXQsIGFyZ3MubGVuZ3RoLCB0cnVlKTtcbiAgICAgICAgbWVtb3J5Vmlldy5zZXRVaW50MzIoXG4gICAgICAgICAgYXJndkJ1ZmZlclNpemVPZmZzZXQsXG4gICAgICAgICAgYXJncy5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgYXJnKSB7XG4gICAgICAgICAgICByZXR1cm4gYWNjICsgdGV4dEVuY29kZXIuZW5jb2RlKGAke2FyZ31cXDBgKS5sZW5ndGg7XG4gICAgICAgICAgfSwgMCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImVudmlyb25fZ2V0XCI6IHN5c2NhbGwoKFxuICAgICAgICBlbnZpcm9uT2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIGVudmlyb25CdWZmZXJPZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyh0aGlzLiNlbnYpO1xuICAgICAgICBjb25zdCB0ZXh0RW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICAgICAgICBjb25zdCBtZW1vcnlEYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IG1lbW9yeVZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZW50cmllcykge1xuICAgICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKGVudmlyb25PZmZzZXQsIGVudmlyb25CdWZmZXJPZmZzZXQsIHRydWUpO1xuICAgICAgICAgIGVudmlyb25PZmZzZXQgKz0gNDtcblxuICAgICAgICAgIGNvbnN0IGRhdGEgPSB0ZXh0RW5jb2Rlci5lbmNvZGUoYCR7a2V5fT0ke3ZhbHVlfVxcMGApO1xuICAgICAgICAgIG1lbW9yeURhdGEuc2V0KGRhdGEsIGVudmlyb25CdWZmZXJPZmZzZXQpO1xuICAgICAgICAgIGVudmlyb25CdWZmZXJPZmZzZXQgKz0gZGF0YS5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImVudmlyb25fc2l6ZXNfZ2V0XCI6IHN5c2NhbGwoKFxuICAgICAgICBlbnZpcm9uY09mZnNldDogbnVtYmVyLFxuICAgICAgICBlbnZpcm9uQnVmZmVyU2l6ZU9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHRoaXMuI2Vudik7XG4gICAgICAgIGNvbnN0IHRleHRFbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICAgICAgIGNvbnN0IG1lbW9yeVZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRVaW50MzIoZW52aXJvbmNPZmZzZXQsIGVudHJpZXMubGVuZ3RoLCB0cnVlKTtcbiAgICAgICAgbWVtb3J5Vmlldy5zZXRVaW50MzIoXG4gICAgICAgICAgZW52aXJvbkJ1ZmZlclNpemVPZmZzZXQsXG4gICAgICAgICAgZW50cmllcy5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgW2tleSwgdmFsdWVdKSB7XG4gICAgICAgICAgICByZXR1cm4gYWNjICsgdGV4dEVuY29kZXIuZW5jb2RlKGAke2tleX09JHt2YWx1ZX1cXDBgKS5sZW5ndGg7XG4gICAgICAgICAgfSwgMCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImNsb2NrX3Jlc19nZXRcIjogc3lzY2FsbCgoXG4gICAgICAgIGlkOiBudW1iZXIsXG4gICAgICAgIHJlc29sdXRpb25PZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IG1lbW9yeVZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG5cbiAgICAgICAgc3dpdGNoIChpZCkge1xuICAgICAgICAgIGNhc2UgQ0xPQ0tJRF9SRUFMVElNRToge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IEJpZ0ludCgxZTYpO1xuXG4gICAgICAgICAgICBtZW1vcnlWaWV3LnNldEJpZ1VpbnQ2NChcbiAgICAgICAgICAgICAgcmVzb2x1dGlvbk9mZnNldCxcbiAgICAgICAgICAgICAgcmVzb2x1dGlvbixcbiAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlIENMT0NLSURfTU9OT1RPTklDOlxuICAgICAgICAgIGNhc2UgQ0xPQ0tJRF9QUk9DRVNTX0NQVVRJTUVfSUQ6XG4gICAgICAgICAgY2FzZSBDTE9DS0lEX1RIUkVBRF9DUFVUSU1FX0lEOiB7XG4gICAgICAgICAgICBjb25zdCByZXNvbHV0aW9uID0gQmlnSW50KDFlMyk7XG4gICAgICAgICAgICBtZW1vcnlWaWV3LnNldEJpZ1VpbnQ2NChyZXNvbHV0aW9uT2Zmc2V0LCByZXNvbHV0aW9uLCB0cnVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gRVJSTk9fSU5WQUw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImNsb2NrX3RpbWVfZ2V0XCI6IHN5c2NhbGwoKFxuICAgICAgICBpZDogbnVtYmVyLFxuICAgICAgICBwcmVjaXNpb246IGJpZ2ludCxcbiAgICAgICAgdGltZU9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgbWVtb3J5VmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLiNtZW1vcnkuYnVmZmVyKTtcblxuICAgICAgICBzd2l0Y2ggKGlkKSB7XG4gICAgICAgICAgY2FzZSBDTE9DS0lEX1JFQUxUSU1FOiB7XG4gICAgICAgICAgICBjb25zdCB0aW1lID0gQmlnSW50KERhdGUubm93KCkpICogQmlnSW50KDFlNik7XG4gICAgICAgICAgICBtZW1vcnlWaWV3LnNldEJpZ1VpbnQ2NCh0aW1lT2Zmc2V0LCB0aW1lLCB0cnVlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNhc2UgQ0xPQ0tJRF9NT05PVE9OSUM6XG4gICAgICAgICAgY2FzZSBDTE9DS0lEX1BST0NFU1NfQ1BVVElNRV9JRDpcbiAgICAgICAgICBjYXNlIENMT0NLSURfVEhSRUFEX0NQVVRJTUVfSUQ6IHtcbiAgICAgICAgICAgIGNvbnN0IHQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBNYXRoLnRydW5jKHQpO1xuICAgICAgICAgICAgY29uc3QgbXMgPSBNYXRoLmZsb29yKCh0IC0gcykgKiAxZTMpO1xuXG4gICAgICAgICAgICBjb25zdCB0aW1lID0gQmlnSW50KHMpICogQmlnSW50KDFlOSkgKyBCaWdJbnQobXMpICogQmlnSW50KDFlNik7XG5cbiAgICAgICAgICAgIG1lbW9yeVZpZXcuc2V0QmlnVWludDY0KHRpbWVPZmZzZXQsIHRpbWUsIHRydWUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwiZmRfYWR2aXNlXCI6IHN5c2NhbGwoKFxuICAgICAgICBfZmQ6IG51bWJlcixcbiAgICAgICAgX29mZnNldDogYmlnaW50LFxuICAgICAgICBfbGVuZ3RoOiBiaWdpbnQsXG4gICAgICAgIF9hZHZpY2U6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIHJldHVybiBFUlJOT19OT1NZUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX2FsbG9jYXRlXCI6IHN5c2NhbGwoKFxuICAgICAgICBfZmQ6IG51bWJlcixcbiAgICAgICAgX29mZnNldDogYmlnaW50LFxuICAgICAgICBfbGVuZ3RoOiBiaWdpbnQsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICByZXR1cm4gRVJSTk9fTk9TWVM7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9jbG9zZVwiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy4jZmRzW2ZkXTtcbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19CQURGO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVudHJ5LnJpZCkge1xuICAgICAgICAgIERlbm8uY2xvc2UoZW50cnkucmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbGV0ZSB0aGlzLiNmZHNbZmRdO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwiZmRfZGF0YXN5bmNcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlbm8uZmRhdGFzeW5jU3luYyhlbnRyeS5yaWQhKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX2Zkc3RhdF9nZXRcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIG9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQ4KG9mZnNldCwgZW50cnkudHlwZSEpO1xuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQxNihvZmZzZXQgKyAyLCBlbnRyeS5mbGFncyEsIHRydWUpO1xuICAgICAgICAvLyBUT0RPKGJhcnRsb21pZWp1KVxuICAgICAgICBtZW1vcnlWaWV3LnNldEJpZ1VpbnQ2NChvZmZzZXQgKyA4LCAwbiwgdHJ1ZSk7XG4gICAgICAgIC8vIFRPRE8oYmFydGxvbWllanUpXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0QmlnVWludDY0KG9mZnNldCArIDE2LCAwbiwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9mZHN0YXRfc2V0X2ZsYWdzXCI6IHN5c2NhbGwoKFxuICAgICAgICBfZmQ6IG51bWJlcixcbiAgICAgICAgX2ZsYWdzOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICByZXR1cm4gRVJSTk9fTk9TWVM7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9mZHN0YXRfc2V0X3JpZ2h0c1wiOiBzeXNjYWxsKChcbiAgICAgICAgX2ZkOiBudW1iZXIsXG4gICAgICAgIF9yaWdodHNCYXNlOiBiaWdpbnQsXG4gICAgICAgIF9yaWdodHNJbmhlcml0aW5nOiBiaWdpbnQsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICByZXR1cm4gRVJSTk9fTk9TWVM7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9maWxlc3RhdF9nZXRcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIG9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuXG4gICAgICAgIGNvbnN0IGluZm8gPSBEZW5vLmZzdGF0U3luYyhlbnRyeS5yaWQhKTtcblxuICAgICAgICBpZiAoZW50cnkudHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc3dpdGNoICh0cnVlKSB7XG4gICAgICAgICAgICBjYXNlIGluZm8uaXNGaWxlOlxuICAgICAgICAgICAgICBlbnRyeS50eXBlID0gRklMRVRZUEVfUkVHVUxBUl9GSUxFO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBpbmZvLmlzRGlyZWN0b3J5OlxuICAgICAgICAgICAgICBlbnRyeS50eXBlID0gRklMRVRZUEVfRElSRUNUT1JZO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBpbmZvLmlzU3ltbGluazpcbiAgICAgICAgICAgICAgZW50cnkudHlwZSA9IEZJTEVUWVBFX1NZTUJPTElDX0xJTks7XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBlbnRyeS50eXBlID0gRklMRVRZUEVfVU5LTk9XTjtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQob2Zmc2V0LCBCaWdJbnQoaW5mby5kZXYgPyBpbmZvLmRldiA6IDApLCB0cnVlKTtcbiAgICAgICAgb2Zmc2V0ICs9IDg7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQob2Zmc2V0LCBCaWdJbnQoaW5mby5pbm8gPyBpbmZvLmlubyA6IDApLCB0cnVlKTtcbiAgICAgICAgb2Zmc2V0ICs9IDg7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRVaW50OChvZmZzZXQsIGVudHJ5LnR5cGUpO1xuICAgICAgICBvZmZzZXQgKz0gODtcblxuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQzMihvZmZzZXQsIE51bWJlcihpbmZvLm5saW5rKSwgdHJ1ZSk7XG4gICAgICAgIG9mZnNldCArPSA4O1xuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0QmlnVWludDY0KG9mZnNldCwgQmlnSW50KGluZm8uc2l6ZSksIHRydWUpO1xuICAgICAgICBvZmZzZXQgKz0gODtcblxuICAgICAgICBtZW1vcnlWaWV3LnNldEJpZ1VpbnQ2NChcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgQmlnSW50KGluZm8uYXRpbWUgPyBpbmZvLmF0aW1lLmdldFRpbWUoKSAqIDFlNiA6IDApLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIG9mZnNldCArPSA4O1xuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0QmlnVWludDY0KFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBCaWdJbnQoaW5mby5tdGltZSA/IGluZm8ubXRpbWUuZ2V0VGltZSgpICogMWU2IDogMCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgb2Zmc2V0ICs9IDg7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQoXG4gICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgIEJpZ0ludChpbmZvLmJpcnRodGltZSA/IGluZm8uYmlydGh0aW1lLmdldFRpbWUoKSAqIDFlNiA6IDApLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIG9mZnNldCArPSA4O1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwiZmRfZmlsZXN0YXRfc2V0X3NpemVcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIHNpemU6IGJpZ2ludCxcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy4jZmRzW2ZkXTtcbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19CQURGO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVuby5mdHJ1bmNhdGVTeW5jKGVudHJ5LnJpZCEsIE51bWJlcihzaXplKSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9maWxlc3RhdF9zZXRfdGltZXNcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIGF0aW06IGJpZ2ludCxcbiAgICAgICAgbXRpbTogYmlnaW50LFxuICAgICAgICBmbGFnczogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVudHJ5LnBhdGgpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fSU5WQUw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKGZsYWdzICYgRlNURkxBR1NfQVRJTV9OT1cpID09IEZTVEZMQUdTX0FUSU1fTk9XKSB7XG4gICAgICAgICAgYXRpbSA9IEJpZ0ludChEYXRlLm5vdygpICogMWU2KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgoZmxhZ3MgJiBGU1RGTEFHU19NVElNX05PVykgPT0gRlNURkxBR1NfTVRJTV9OT1cpIHtcbiAgICAgICAgICBtdGltID0gQmlnSW50KERhdGUubm93KCkgKiAxZTYpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVuby51dGltZVN5bmMoZW50cnkucGF0aCEsIE51bWJlcihhdGltKSwgTnVtYmVyKG10aW0pKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX3ByZWFkXCI6IHN5c2NhbGwoKFxuICAgICAgICBmZDogbnVtYmVyLFxuICAgICAgICBpb3ZzT2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIGlvdnNMZW5ndGg6IG51bWJlcixcbiAgICAgICAgb2Zmc2V0OiBiaWdpbnQsXG4gICAgICAgIG5yZWFkT2Zmc2V0OiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmIChlbnRyeSA9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZWVrID0gRGVuby5zZWVrU3luYyhlbnRyeS5yaWQhLCAwLCBEZW5vLlNlZWtNb2RlLkN1cnJlbnQpO1xuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuXG4gICAgICAgIGxldCBucmVhZCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW92c0xlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgZGF0YU9mZnNldCA9IG1lbW9yeVZpZXcuZ2V0VWludDMyKGlvdnNPZmZzZXQsIHRydWUpO1xuICAgICAgICAgIGlvdnNPZmZzZXQgKz0gNDtcblxuICAgICAgICAgIGNvbnN0IGRhdGFMZW5ndGggPSBtZW1vcnlWaWV3LmdldFVpbnQzMihpb3ZzT2Zmc2V0LCB0cnVlKTtcbiAgICAgICAgICBpb3ZzT2Zmc2V0ICs9IDQ7XG5cbiAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgICAgZGF0YU9mZnNldCxcbiAgICAgICAgICAgIGRhdGFMZW5ndGgsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBucmVhZCArPSBEZW5vLnJlYWRTeW5jKGVudHJ5LnJpZCEsIGRhdGEpIGFzIG51bWJlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlbm8uc2Vla1N5bmMoZW50cnkucmlkISwgc2VlaywgRGVuby5TZWVrTW9kZS5TdGFydCk7XG4gICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKG5yZWFkT2Zmc2V0LCBucmVhZCwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9wcmVzdGF0X2dldFwiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgcHJlc3RhdE9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVudHJ5LnZwYXRoKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQ4KHByZXN0YXRPZmZzZXQsIFBSRU9QRU5UWVBFX0RJUik7XG4gICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKFxuICAgICAgICAgIHByZXN0YXRPZmZzZXQgKyA0LFxuICAgICAgICAgIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShlbnRyeS52cGF0aCkuYnl0ZUxlbmd0aCxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwiZmRfcHJlc3RhdF9kaXJfbmFtZVwiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgcGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBwYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW50cnkudnBhdGgpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIHBhdGhPZmZzZXQsXG4gICAgICAgICAgcGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgZGF0YS5zZXQobmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGVudHJ5LnZwYXRoKSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9wd3JpdGVcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIGlvdnNPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgaW92c0xlbmd0aDogbnVtYmVyLFxuICAgICAgICBvZmZzZXQ6IGJpZ2ludCxcbiAgICAgICAgbndyaXR0ZW5PZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy4jZmRzW2ZkXTtcbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19CQURGO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2VlayA9IERlbm8uc2Vla1N5bmMoZW50cnkucmlkISwgMCwgRGVuby5TZWVrTW9kZS5DdXJyZW50KTtcbiAgICAgICAgY29uc3QgbWVtb3J5VmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLiNtZW1vcnkuYnVmZmVyKTtcblxuICAgICAgICBsZXQgbndyaXR0ZW4gPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlvdnNMZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGRhdGFPZmZzZXQgPSBtZW1vcnlWaWV3LmdldFVpbnQzMihpb3ZzT2Zmc2V0LCB0cnVlKTtcbiAgICAgICAgICBpb3ZzT2Zmc2V0ICs9IDQ7XG5cbiAgICAgICAgICBjb25zdCBkYXRhTGVuZ3RoID0gbWVtb3J5Vmlldy5nZXRVaW50MzIoaW92c09mZnNldCwgdHJ1ZSk7XG4gICAgICAgICAgaW92c09mZnNldCArPSA0O1xuXG4gICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgICAgdGhpcy4jbWVtb3J5LmJ1ZmZlcixcbiAgICAgICAgICAgIGRhdGFPZmZzZXQsXG4gICAgICAgICAgICBkYXRhTGVuZ3RoLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbndyaXR0ZW4gKz0gRGVuby53cml0ZVN5bmMoZW50cnkucmlkISwgZGF0YSkgYXMgbnVtYmVyO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVuby5zZWVrU3luYyhlbnRyeS5yaWQhLCBzZWVrLCBEZW5vLlNlZWtNb2RlLlN0YXJ0KTtcbiAgICAgICAgbWVtb3J5Vmlldy5zZXRVaW50MzIobndyaXR0ZW5PZmZzZXQsIG53cml0dGVuLCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX3JlYWRcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIGlvdnNPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgaW92c0xlbmd0aDogbnVtYmVyLFxuICAgICAgICBucmVhZE9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuXG4gICAgICAgIGxldCBucmVhZCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW92c0xlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgZGF0YU9mZnNldCA9IG1lbW9yeVZpZXcuZ2V0VWludDMyKGlvdnNPZmZzZXQsIHRydWUpO1xuICAgICAgICAgIGlvdnNPZmZzZXQgKz0gNDtcblxuICAgICAgICAgIGNvbnN0IGRhdGFMZW5ndGggPSBtZW1vcnlWaWV3LmdldFVpbnQzMihpb3ZzT2Zmc2V0LCB0cnVlKTtcbiAgICAgICAgICBpb3ZzT2Zmc2V0ICs9IDQ7XG5cbiAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgICAgZGF0YU9mZnNldCxcbiAgICAgICAgICAgIGRhdGFMZW5ndGgsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBucmVhZCArPSBEZW5vLnJlYWRTeW5jKGVudHJ5LnJpZCEsIGRhdGEpIGFzIG51bWJlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKG5yZWFkT2Zmc2V0LCBucmVhZCwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9yZWFkZGlyXCI6IHN5c2NhbGwoKFxuICAgICAgICBmZDogbnVtYmVyLFxuICAgICAgICBidWZmZXJPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgYnVmZmVyTGVuZ3RoOiBudW1iZXIsXG4gICAgICAgIGNvb2tpZTogYmlnaW50LFxuICAgICAgICBidWZmZXJVc2VkT2Zmc2V0OiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lbW9yeURhdGEgPSBuZXcgVWludDhBcnJheSh0aGlzLiNtZW1vcnkuYnVmZmVyKTtcbiAgICAgICAgY29uc3QgbWVtb3J5VmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLiNtZW1vcnkuYnVmZmVyKTtcblxuICAgICAgICBsZXQgYnVmZmVyVXNlZCA9IDA7XG5cbiAgICAgICAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20oRGVuby5yZWFkRGlyU3luYyhlbnRyeS5wYXRoISkpO1xuICAgICAgICBmb3IgKGxldCBpID0gTnVtYmVyKGNvb2tpZSk7IGkgPCBlbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgbmFtZURhdGEgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoZW50cmllc1tpXS5uYW1lKTtcblxuICAgICAgICAgIGNvbnN0IGVudHJ5SW5mbyA9IERlbm8uc3RhdFN5bmMoXG4gICAgICAgICAgICByZXNvbHZlKGVudHJ5LnBhdGghLCBlbnRyaWVzW2ldLm5hbWUpLFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgZW50cnlEYXRhID0gbmV3IFVpbnQ4QXJyYXkoMjQgKyBuYW1lRGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICBjb25zdCBlbnRyeVZpZXcgPSBuZXcgRGF0YVZpZXcoZW50cnlEYXRhLmJ1ZmZlcik7XG5cbiAgICAgICAgICBlbnRyeVZpZXcuc2V0QmlnVWludDY0KDAsIEJpZ0ludChpICsgMSksIHRydWUpO1xuICAgICAgICAgIGVudHJ5Vmlldy5zZXRCaWdVaW50NjQoXG4gICAgICAgICAgICA4LFxuICAgICAgICAgICAgQmlnSW50KGVudHJ5SW5mby5pbm8gPyBlbnRyeUluZm8uaW5vIDogMCksXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICk7XG4gICAgICAgICAgZW50cnlWaWV3LnNldFVpbnQzMigxNiwgbmFtZURhdGEuYnl0ZUxlbmd0aCwgdHJ1ZSk7XG5cbiAgICAgICAgICBsZXQgdHlwZTogbnVtYmVyO1xuICAgICAgICAgIHN3aXRjaCAodHJ1ZSkge1xuICAgICAgICAgICAgY2FzZSBlbnRyaWVzW2ldLmlzRmlsZTpcbiAgICAgICAgICAgICAgdHlwZSA9IEZJTEVUWVBFX1JFR1VMQVJfRklMRTtcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgZW50cmllc1tpXS5pc0RpcmVjdG9yeTpcbiAgICAgICAgICAgICAgdHlwZSA9IEZJTEVUWVBFX1JFR1VMQVJfRklMRTtcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgZW50cmllc1tpXS5pc1N5bWxpbms6XG4gICAgICAgICAgICAgIHR5cGUgPSBGSUxFVFlQRV9TWU1CT0xJQ19MSU5LO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdHlwZSA9IEZJTEVUWVBFX1JFR1VMQVJfRklMRTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZW50cnlWaWV3LnNldFVpbnQ4KDIwLCB0eXBlKTtcbiAgICAgICAgICBlbnRyeURhdGEuc2V0KG5hbWVEYXRhLCAyNCk7XG5cbiAgICAgICAgICBjb25zdCBkYXRhID0gZW50cnlEYXRhLnNsaWNlKFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIE1hdGgubWluKGVudHJ5RGF0YS5sZW5ndGgsIGJ1ZmZlckxlbmd0aCAtIGJ1ZmZlclVzZWQpLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbWVtb3J5RGF0YS5zZXQoZGF0YSwgYnVmZmVyT2Zmc2V0ICsgYnVmZmVyVXNlZCk7XG4gICAgICAgICAgYnVmZmVyVXNlZCArPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQzMihidWZmZXJVc2VkT2Zmc2V0LCBidWZmZXJVc2VkLCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX3JlbnVtYmVyXCI6IHN5c2NhbGwoKFxuICAgICAgICBmZDogbnVtYmVyLFxuICAgICAgICB0bzogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLiNmZHNbZmRdKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuI2Zkc1t0b10pIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLiNmZHNbdG9dLnJpZCkge1xuICAgICAgICAgIERlbm8uY2xvc2UodGhpcy4jZmRzW3RvXS5yaWQhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuI2Zkc1t0b10gPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBkZWxldGUgdGhpcy4jZmRzW2ZkXTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX3NlZWtcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIG9mZnNldDogYmlnaW50LFxuICAgICAgICB3aGVuY2U6IG51bWJlcixcbiAgICAgICAgbmV3T2Zmc2V0T2Zmc2V0OiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lbW9yeVZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG5cbiAgICAgICAgLy8gRklYTUUgRGVubyBkb2VzIG5vdCBzdXBwb3J0IHNlZWtpbmcgd2l0aCBiaWcgaW50ZWdlcnNcbiAgICAgICAgY29uc3QgbmV3T2Zmc2V0ID0gRGVuby5zZWVrU3luYyhlbnRyeS5yaWQhLCBOdW1iZXIob2Zmc2V0KSwgd2hlbmNlKTtcbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQobmV3T2Zmc2V0T2Zmc2V0LCBCaWdJbnQobmV3T2Zmc2V0KSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF9zeW5jXCI6IHN5c2NhbGwoKFxuICAgICAgICBmZDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBEZW5vLmZzeW5jU3luYyhlbnRyeS5yaWQhKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcImZkX3RlbGxcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIG9mZnNldE9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuXG4gICAgICAgIGNvbnN0IG9mZnNldCA9IERlbm8uc2Vla1N5bmMoZW50cnkucmlkISwgMCwgRGVuby5TZWVrTW9kZS5DdXJyZW50KTtcbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQob2Zmc2V0T2Zmc2V0LCBCaWdJbnQob2Zmc2V0KSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJmZF93cml0ZVwiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgaW92c09mZnNldDogbnVtYmVyLFxuICAgICAgICBpb3ZzTGVuZ3RoOiBudW1iZXIsXG4gICAgICAgIG53cml0dGVuT2Zmc2V0OiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1lbW9yeVZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG5cbiAgICAgICAgbGV0IG53cml0dGVuID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpb3ZzTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBkYXRhT2Zmc2V0ID0gbWVtb3J5Vmlldy5nZXRVaW50MzIoaW92c09mZnNldCwgdHJ1ZSk7XG4gICAgICAgICAgaW92c09mZnNldCArPSA0O1xuXG4gICAgICAgICAgY29uc3QgZGF0YUxlbmd0aCA9IG1lbW9yeVZpZXcuZ2V0VWludDMyKGlvdnNPZmZzZXQsIHRydWUpO1xuICAgICAgICAgIGlvdnNPZmZzZXQgKz0gNDtcblxuICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICAgIHRoaXMuI21lbW9yeS5idWZmZXIsXG4gICAgICAgICAgICBkYXRhT2Zmc2V0LFxuICAgICAgICAgICAgZGF0YUxlbmd0aCxcbiAgICAgICAgICApO1xuICAgICAgICAgIG53cml0dGVuICs9IERlbm8ud3JpdGVTeW5jKGVudHJ5LnJpZCEsIGRhdGEpIGFzIG51bWJlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKG53cml0dGVuT2Zmc2V0LCBud3JpdHRlbiwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJwYXRoX2NyZWF0ZV9kaXJlY3RvcnlcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIHBhdGhPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgcGF0aExlbmd0aDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVudHJ5LnBhdGgpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fSU5WQUw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgICAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgdGhpcy4jbWVtb3J5LmJ1ZmZlcixcbiAgICAgICAgICBwYXRoT2Zmc2V0LFxuICAgICAgICAgIHBhdGhMZW5ndGgsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHBhdGggPSByZXNvbHZlKGVudHJ5LnBhdGghLCB0ZXh0RGVjb2Rlci5kZWNvZGUoZGF0YSkpO1xuXG4gICAgICAgIERlbm8ubWtkaXJTeW5jKHBhdGgpO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicGF0aF9maWxlc3RhdF9nZXRcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIGZsYWdzOiBudW1iZXIsXG4gICAgICAgIHBhdGhPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgcGF0aExlbmd0aDogbnVtYmVyLFxuICAgICAgICBidWZmZXJPZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy4jZmRzW2ZkXTtcbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19CQURGO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbnRyeS5wYXRoKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0lOVkFMO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgIHRoaXMuI21lbW9yeS5idWZmZXIsXG4gICAgICAgICAgcGF0aE9mZnNldCxcbiAgICAgICAgICBwYXRoTGVuZ3RoLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBwYXRoID0gcmVzb2x2ZShlbnRyeS5wYXRoISwgdGV4dERlY29kZXIuZGVjb2RlKGRhdGEpKTtcblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuXG4gICAgICAgIGNvbnN0IGluZm8gPSAoZmxhZ3MgJiBMT09LVVBGTEFHU19TWU1MSU5LX0ZPTExPVykgIT0gMFxuICAgICAgICAgID8gRGVuby5zdGF0U3luYyhwYXRoKVxuICAgICAgICAgIDogRGVuby5sc3RhdFN5bmMocGF0aCk7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQoXG4gICAgICAgICAgYnVmZmVyT2Zmc2V0LFxuICAgICAgICAgIEJpZ0ludChpbmZvLmRldiA/IGluZm8uZGV2IDogMCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgYnVmZmVyT2Zmc2V0ICs9IDg7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQoXG4gICAgICAgICAgYnVmZmVyT2Zmc2V0LFxuICAgICAgICAgIEJpZ0ludChpbmZvLmlubyA/IGluZm8uaW5vIDogMCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgYnVmZmVyT2Zmc2V0ICs9IDg7XG5cbiAgICAgICAgc3dpdGNoICh0cnVlKSB7XG4gICAgICAgICAgY2FzZSBpbmZvLmlzRmlsZTpcbiAgICAgICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDgoYnVmZmVyT2Zmc2V0LCBGSUxFVFlQRV9SRUdVTEFSX0ZJTEUpO1xuICAgICAgICAgICAgYnVmZmVyT2Zmc2V0ICs9IDg7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgaW5mby5pc0RpcmVjdG9yeTpcbiAgICAgICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDgoYnVmZmVyT2Zmc2V0LCBGSUxFVFlQRV9ESVJFQ1RPUlkpO1xuICAgICAgICAgICAgYnVmZmVyT2Zmc2V0ICs9IDg7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgaW5mby5pc1N5bWxpbms6XG4gICAgICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQ4KGJ1ZmZlck9mZnNldCwgRklMRVRZUEVfU1lNQk9MSUNfTElOSyk7XG4gICAgICAgICAgICBidWZmZXJPZmZzZXQgKz0gODtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDgoYnVmZmVyT2Zmc2V0LCBGSUxFVFlQRV9VTktOT1dOKTtcbiAgICAgICAgICAgIGJ1ZmZlck9mZnNldCArPSA4O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQzMihidWZmZXJPZmZzZXQsIE51bWJlcihpbmZvLm5saW5rKSwgdHJ1ZSk7XG4gICAgICAgIGJ1ZmZlck9mZnNldCArPSA4O1xuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0QmlnVWludDY0KGJ1ZmZlck9mZnNldCwgQmlnSW50KGluZm8uc2l6ZSksIHRydWUpO1xuICAgICAgICBidWZmZXJPZmZzZXQgKz0gODtcblxuICAgICAgICBtZW1vcnlWaWV3LnNldEJpZ1VpbnQ2NChcbiAgICAgICAgICBidWZmZXJPZmZzZXQsXG4gICAgICAgICAgQmlnSW50KGluZm8uYXRpbWUgPyBpbmZvLmF0aW1lLmdldFRpbWUoKSAqIDFlNiA6IDApLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIGJ1ZmZlck9mZnNldCArPSA4O1xuXG4gICAgICAgIG1lbW9yeVZpZXcuc2V0QmlnVWludDY0KFxuICAgICAgICAgIGJ1ZmZlck9mZnNldCxcbiAgICAgICAgICBCaWdJbnQoaW5mby5tdGltZSA/IGluZm8ubXRpbWUuZ2V0VGltZSgpICogMWU2IDogMCksXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgICAgYnVmZmVyT2Zmc2V0ICs9IDg7XG5cbiAgICAgICAgbWVtb3J5Vmlldy5zZXRCaWdVaW50NjQoXG4gICAgICAgICAgYnVmZmVyT2Zmc2V0LFxuICAgICAgICAgIEJpZ0ludChpbmZvLmJpcnRodGltZSA/IGluZm8uYmlydGh0aW1lLmdldFRpbWUoKSAqIDFlNiA6IDApLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICAgIGJ1ZmZlck9mZnNldCArPSA4O1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicGF0aF9maWxlc3RhdF9zZXRfdGltZXNcIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIGZsYWdzOiBudW1iZXIsXG4gICAgICAgIHBhdGhPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgcGF0aExlbmd0aDogbnVtYmVyLFxuICAgICAgICBhdGltOiBiaWdpbnQsXG4gICAgICAgIG10aW06IGJpZ2ludCxcbiAgICAgICAgZnN0ZmxhZ3M6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy4jZmRzW2ZkXTtcbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19CQURGO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbnRyeS5wYXRoKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0lOVkFMO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgIHRoaXMuI21lbW9yeS5idWZmZXIsXG4gICAgICAgICAgcGF0aE9mZnNldCxcbiAgICAgICAgICBwYXRoTGVuZ3RoLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBwYXRoID0gcmVzb2x2ZShlbnRyeS5wYXRoISwgdGV4dERlY29kZXIuZGVjb2RlKGRhdGEpKTtcblxuICAgICAgICBpZiAoKGZzdGZsYWdzICYgRlNURkxBR1NfQVRJTV9OT1cpID09IEZTVEZMQUdTX0FUSU1fTk9XKSB7XG4gICAgICAgICAgYXRpbSA9IEJpZ0ludChEYXRlLm5vdygpKSAqIEJpZ0ludCgxZTYpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChmc3RmbGFncyAmIEZTVEZMQUdTX01USU1fTk9XKSA9PSBGU1RGTEFHU19NVElNX05PVykge1xuICAgICAgICAgIG10aW0gPSBCaWdJbnQoRGF0ZS5ub3coKSkgKiBCaWdJbnQoMWU2KTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlbm8udXRpbWVTeW5jKHBhdGgsIE51bWJlcihhdGltKSwgTnVtYmVyKG10aW0pKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcInBhdGhfbGlua1wiOiBzeXNjYWxsKChcbiAgICAgICAgb2xkRmQ6IG51bWJlcixcbiAgICAgICAgb2xkRmxhZ3M6IG51bWJlcixcbiAgICAgICAgb2xkUGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBvbGRQYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICAgIG5ld0ZkOiBudW1iZXIsXG4gICAgICAgIG5ld1BhdGhPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgbmV3UGF0aExlbmd0aDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgb2xkRW50cnkgPSB0aGlzLiNmZHNbb2xkRmRdO1xuICAgICAgICBjb25zdCBuZXdFbnRyeSA9IHRoaXMuI2Zkc1tuZXdGZF07XG4gICAgICAgIGlmICghb2xkRW50cnkgfHwgIW5ld0VudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9sZEVudHJ5LnBhdGggfHwgIW5ld0VudHJ5LnBhdGgpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fSU5WQUw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgICAgICBjb25zdCBvbGREYXRhID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgdGhpcy4jbWVtb3J5LmJ1ZmZlcixcbiAgICAgICAgICBvbGRQYXRoT2Zmc2V0LFxuICAgICAgICAgIG9sZFBhdGhMZW5ndGgsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IG9sZFBhdGggPSByZXNvbHZlKG9sZEVudHJ5LnBhdGghLCB0ZXh0RGVjb2Rlci5kZWNvZGUob2xkRGF0YSkpO1xuICAgICAgICBjb25zdCBuZXdEYXRhID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgdGhpcy4jbWVtb3J5LmJ1ZmZlcixcbiAgICAgICAgICBuZXdQYXRoT2Zmc2V0LFxuICAgICAgICAgIG5ld1BhdGhMZW5ndGgsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IG5ld1BhdGggPSByZXNvbHZlKG5ld0VudHJ5LnBhdGghLCB0ZXh0RGVjb2Rlci5kZWNvZGUobmV3RGF0YSkpO1xuXG4gICAgICAgIERlbm8ubGlua1N5bmMob2xkUGF0aCwgbmV3UGF0aCk7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJwYXRoX29wZW5cIjogc3lzY2FsbCgoXG4gICAgICAgIGZkOiBudW1iZXIsXG4gICAgICAgIGRpcmZsYWdzOiBudW1iZXIsXG4gICAgICAgIHBhdGhPZmZzZXQ6IG51bWJlcixcbiAgICAgICAgcGF0aExlbmd0aDogbnVtYmVyLFxuICAgICAgICBvZmxhZ3M6IG51bWJlcixcbiAgICAgICAgcmlnaHRzQmFzZTogYmlnaW50LFxuICAgICAgICByaWdodHNJbmhlcml0aW5nOiBiaWdpbnQsXG4gICAgICAgIGZkZmxhZ3M6IG51bWJlcixcbiAgICAgICAgb3BlbmVkRmRPZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy4jZmRzW2ZkXTtcbiAgICAgICAgaWYgKCFlbnRyeSkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19CQURGO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbnRyeS5wYXRoKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0lOVkFMO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICAgICAgY29uc3QgcGF0aERhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIHBhdGhPZmZzZXQsXG4gICAgICAgICAgcGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcmVzb2x2ZShlbnRyeS5wYXRoISwgdGV4dERlY29kZXIuZGVjb2RlKHBhdGhEYXRhKSk7XG5cbiAgICAgICAgaWYgKHJlbGF0aXZlKGVudHJ5LnBhdGgsIHJlc29sdmVkUGF0aCkuc3RhcnRzV2l0aChcIi4uXCIpKSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX05PVENBUEFCTEU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcGF0aDtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIChkaXJmbGFncyAmIExPT0tVUEZMQUdTX1NZTUxJTktfRk9MTE9XKSA9PSBMT09LVVBGTEFHU19TWU1MSU5LX0ZPTExPV1xuICAgICAgICApIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcGF0aCA9IERlbm8ucmVhbFBhdGhTeW5jKHJlc29sdmVkUGF0aCk7XG4gICAgICAgICAgICBpZiAocmVsYXRpdmUoZW50cnkucGF0aCwgcGF0aCkuc3RhcnRzV2l0aChcIi4uXCIpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBFUlJOT19OT1RDQVBBQkxFO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKF9lcnIpIHtcbiAgICAgICAgICAgIHBhdGggPSByZXNvbHZlZFBhdGg7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhdGggPSByZXNvbHZlZFBhdGg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKG9mbGFncyAmIE9GTEFHU19ESVJFQ1RPUlkpICE9PSAwKSB7XG4gICAgICAgICAgLy8gWFhYIChjYXNwZXJ2b25iKSB0aGlzIGlzbid0IGlkZWFsIGFzIHdlIGNhbid0IGdldCBhIHJpZCBmb3IgdGhlXG4gICAgICAgICAgLy8gZGlyZWN0b3J5IHRoaXMgd2F5IHNvIHRoZXJlJ3Mgbm8gbmF0aXZlIGZzdGF0IGJ1dCBEZW5vLm9wZW5cbiAgICAgICAgICAvLyBkb2Vzbid0IHdvcmsgd2l0aCBkaXJlY3RvcmllcyBvbiB3aW5kb3dzIHNvIHdlJ2xsIGhhdmUgdG8gd29ya1xuICAgICAgICAgIC8vIGFyb3VuZCBpdCBmb3Igbm93LlxuICAgICAgICAgIGNvbnN0IGVudHJpZXMgPSBBcnJheS5mcm9tKERlbm8ucmVhZERpclN5bmMocGF0aCkpO1xuICAgICAgICAgIGNvbnN0IG9wZW5lZEZkID0gdGhpcy4jZmRzLnB1c2goe1xuICAgICAgICAgICAgZmxhZ3M6IGZkZmxhZ3MsXG4gICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgZW50cmllcyxcbiAgICAgICAgICB9KSAtIDE7XG5cbiAgICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuICAgICAgICAgIG1lbW9yeVZpZXcuc2V0VWludDMyKG9wZW5lZEZkT2Zmc2V0LCBvcGVuZWRGZCwgdHJ1ZSk7XG5cbiAgICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgd3JpdGU6IGZhbHNlLFxuICAgICAgICAgIGFwcGVuZDogZmFsc2UsXG4gICAgICAgICAgdHJ1bmNhdGU6IGZhbHNlLFxuICAgICAgICAgIGNyZWF0ZTogZmFsc2UsXG4gICAgICAgICAgY3JlYXRlTmV3OiBmYWxzZSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoKG9mbGFncyAmIE9GTEFHU19DUkVBVCkgIT09IDApIHtcbiAgICAgICAgICBvcHRpb25zLmNyZWF0ZSA9IHRydWU7XG4gICAgICAgICAgb3B0aW9ucy53cml0ZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKG9mbGFncyAmIE9GTEFHU19FWENMKSAhPT0gMCkge1xuICAgICAgICAgIG9wdGlvbnMuY3JlYXRlTmV3ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgob2ZsYWdzICYgT0ZMQUdTX1RSVU5DKSAhPT0gMCkge1xuICAgICAgICAgIG9wdGlvbnMudHJ1bmNhdGUgPSB0cnVlO1xuICAgICAgICAgIG9wdGlvbnMud3JpdGUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVhZCA9IChcbiAgICAgICAgICBSSUdIVFNfRkRfUkVBRCB8XG4gICAgICAgICAgUklHSFRTX0ZEX1JFQURESVJcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoKHJpZ2h0c0Jhc2UgJiByZWFkKSAhPSAwbikge1xuICAgICAgICAgIG9wdGlvbnMucmVhZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3cml0ZSA9IChcbiAgICAgICAgICBSSUdIVFNfRkRfREFUQVNZTkMgfFxuICAgICAgICAgIFJJR0hUU19GRF9XUklURSB8XG4gICAgICAgICAgUklHSFRTX0ZEX0FMTE9DQVRFIHxcbiAgICAgICAgICBSSUdIVFNfRkRfRklMRVNUQVRfU0VUX1NJWkVcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoKHJpZ2h0c0Jhc2UgJiB3cml0ZSkgIT0gMG4pIHtcbiAgICAgICAgICBvcHRpb25zLndyaXRlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgoZmRmbGFncyAmIEZERkxBR1NfQVBQRU5EKSAhPSAwKSB7XG4gICAgICAgICAgb3B0aW9ucy5hcHBlbmQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChmZGZsYWdzICYgRkRGTEFHU19EU1lOQykgIT0gMCkge1xuICAgICAgICAgIC8vIFRPRE8oY2FzcGVydm9uYik6IHJldmlldyBpZiB3ZSBjYW4gZW11bGF0ZSB0aGlzLlxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChmZGZsYWdzICYgRkRGTEFHU19OT05CTE9DSykgIT0gMCkge1xuICAgICAgICAgIC8vIFRPRE8oY2FzcGVydm9uYik6IHJldmlldyBpZiB3ZSBjYW4gZW11bGF0ZSB0aGlzLlxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChmZGZsYWdzICYgRkRGTEFHU19SU1lOQykgIT0gMCkge1xuICAgICAgICAgIC8vIFRPRE8oY2FzcGVydm9uYik6IHJldmlldyBpZiB3ZSBjYW4gZW11bGF0ZSB0aGlzLlxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKChmZGZsYWdzICYgRkRGTEFHU19TWU5DKSAhPSAwKSB7XG4gICAgICAgICAgLy8gVE9ETyhjYXNwZXJ2b25iKTogcmV2aWV3IGlmIHdlIGNhbiBlbXVsYXRlIHRoaXMuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9wdGlvbnMucmVhZCAmJiAhb3B0aW9ucy53cml0ZSAmJiAhb3B0aW9ucy50cnVuY2F0ZSkge1xuICAgICAgICAgIG9wdGlvbnMucmVhZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7IHJpZCB9ID0gRGVuby5vcGVuU3luYyhwYXRoLCBvcHRpb25zKTtcbiAgICAgICAgY29uc3Qgb3BlbmVkRmQgPSB0aGlzLiNmZHMucHVzaCh7XG4gICAgICAgICAgcmlkLFxuICAgICAgICAgIGZsYWdzOiBmZGZsYWdzLFxuICAgICAgICAgIHBhdGgsXG4gICAgICAgIH0pIC0gMTtcblxuICAgICAgICBjb25zdCBtZW1vcnlWaWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuI21lbW9yeS5idWZmZXIpO1xuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQzMihvcGVuZWRGZE9mZnNldCwgb3BlbmVkRmQsIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicGF0aF9yZWFkbGlua1wiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgcGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBwYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICAgIGJ1ZmZlck9mZnNldDogbnVtYmVyLFxuICAgICAgICBidWZmZXJMZW5ndGg6IG51bWJlcixcbiAgICAgICAgYnVmZmVyVXNlZE9mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgZW50cnkgPSB0aGlzLiNmZHNbZmRdO1xuICAgICAgICBpZiAoIWVudHJ5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX0JBREY7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVudHJ5LnBhdGgpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fSU5WQUw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1vcnlEYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IG1lbW9yeVZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy4jbWVtb3J5LmJ1ZmZlcik7XG5cbiAgICAgICAgY29uc3QgcGF0aERhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIHBhdGhPZmZzZXQsXG4gICAgICAgICAgcGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcGF0aCA9IHJlc29sdmUoZW50cnkucGF0aCEsIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShwYXRoRGF0YSkpO1xuXG4gICAgICAgIGNvbnN0IGxpbmsgPSBEZW5vLnJlYWRMaW5rU3luYyhwYXRoKTtcbiAgICAgICAgY29uc3QgbGlua0RhdGEgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUobGluayk7XG4gICAgICAgIG1lbW9yeURhdGEuc2V0KG5ldyBVaW50OEFycmF5KGxpbmtEYXRhLCAwLCBidWZmZXJMZW5ndGgpLCBidWZmZXJPZmZzZXQpO1xuXG4gICAgICAgIGNvbnN0IGJ1ZmZlclVzZWQgPSBNYXRoLm1pbihsaW5rRGF0YS5ieXRlTGVuZ3RoLCBidWZmZXJMZW5ndGgpO1xuICAgICAgICBtZW1vcnlWaWV3LnNldFVpbnQzMihidWZmZXJVc2VkT2Zmc2V0LCBidWZmZXJVc2VkLCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcInBhdGhfcmVtb3ZlX2RpcmVjdG9yeVwiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgcGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBwYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW50cnkucGF0aCkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRleHREZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIHBhdGhPZmZzZXQsXG4gICAgICAgICAgcGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcGF0aCA9IHJlc29sdmUoZW50cnkucGF0aCEsIHRleHREZWNvZGVyLmRlY29kZShkYXRhKSk7XG5cbiAgICAgICAgaWYgKCFEZW5vLnN0YXRTeW5jKHBhdGgpLmlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgcmV0dXJuIEVSUk5PX05PVERJUjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlbm8ucmVtb3ZlU3luYyhwYXRoKTtcblxuICAgICAgICByZXR1cm4gRVJSTk9fU1VDQ0VTUztcbiAgICAgIH0pLFxuXG4gICAgICBcInBhdGhfcmVuYW1lXCI6IHN5c2NhbGwoKFxuICAgICAgICBmZDogbnVtYmVyLFxuICAgICAgICBvbGRQYXRoT2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIG9sZFBhdGhMZW5ndGg6IG51bWJlcixcbiAgICAgICAgbmV3RmQ6IG51bWJlcixcbiAgICAgICAgbmV3UGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBuZXdQYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBvbGRFbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGNvbnN0IG5ld0VudHJ5ID0gdGhpcy4jZmRzW25ld0ZkXTtcbiAgICAgICAgaWYgKCFvbGRFbnRyeSB8fCAhbmV3RW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb2xkRW50cnkucGF0aCB8fCAhbmV3RW50cnkucGF0aCkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRleHREZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgICAgIGNvbnN0IG9sZERhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIG9sZFBhdGhPZmZzZXQsXG4gICAgICAgICAgb2xkUGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3Qgb2xkUGF0aCA9IHJlc29sdmUob2xkRW50cnkucGF0aCEsIHRleHREZWNvZGVyLmRlY29kZShvbGREYXRhKSk7XG4gICAgICAgIGNvbnN0IG5ld0RhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIG5ld1BhdGhPZmZzZXQsXG4gICAgICAgICAgbmV3UGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgbmV3UGF0aCA9IHJlc29sdmUobmV3RW50cnkucGF0aCEsIHRleHREZWNvZGVyLmRlY29kZShuZXdEYXRhKSk7XG5cbiAgICAgICAgRGVuby5yZW5hbWVTeW5jKG9sZFBhdGgsIG5ld1BhdGgpO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicGF0aF9zeW1saW5rXCI6IHN5c2NhbGwoKFxuICAgICAgICBvbGRQYXRoT2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIG9sZFBhdGhMZW5ndGg6IG51bWJlcixcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgbmV3UGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBuZXdQYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW50cnkucGF0aCkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRleHREZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgICAgIGNvbnN0IG9sZERhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIG9sZFBhdGhPZmZzZXQsXG4gICAgICAgICAgb2xkUGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3Qgb2xkUGF0aCA9IHRleHREZWNvZGVyLmRlY29kZShvbGREYXRhKTtcbiAgICAgICAgY29uc3QgbmV3RGF0YSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgICAgIHRoaXMuI21lbW9yeS5idWZmZXIsXG4gICAgICAgICAgbmV3UGF0aE9mZnNldCxcbiAgICAgICAgICBuZXdQYXRoTGVuZ3RoLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBuZXdQYXRoID0gcmVzb2x2ZShlbnRyeS5wYXRoISwgdGV4dERlY29kZXIuZGVjb2RlKG5ld0RhdGEpKTtcblxuICAgICAgICBEZW5vLnN5bWxpbmtTeW5jKG9sZFBhdGgsIG5ld1BhdGgpO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicGF0aF91bmxpbmtfZmlsZVwiOiBzeXNjYWxsKChcbiAgICAgICAgZmQ6IG51bWJlcixcbiAgICAgICAgcGF0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBwYXRoTGVuZ3RoOiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHRoaXMuI2Zkc1tmZF07XG4gICAgICAgIGlmICghZW50cnkpIHtcbiAgICAgICAgICByZXR1cm4gRVJSTk9fQkFERjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZW50cnkucGF0aCkge1xuICAgICAgICAgIHJldHVybiBFUlJOT19JTlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRleHREZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICB0aGlzLiNtZW1vcnkuYnVmZmVyLFxuICAgICAgICAgIHBhdGhPZmZzZXQsXG4gICAgICAgICAgcGF0aExlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcGF0aCA9IHJlc29sdmUoZW50cnkucGF0aCEsIHRleHREZWNvZGVyLmRlY29kZShkYXRhKSk7XG5cbiAgICAgICAgRGVuby5yZW1vdmVTeW5jKHBhdGgpO1xuXG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicG9sbF9vbmVvZmZcIjogc3lzY2FsbCgoXG4gICAgICAgIF9pbk9mZnNldDogbnVtYmVyLFxuICAgICAgICBfb3V0T2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIF9uc3Vic2NyaXB0aW9uczogbnVtYmVyLFxuICAgICAgICBfbmV2ZW50c09mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgcmV0dXJuIEVSUk5PX05PU1lTO1xuICAgICAgfSksXG5cbiAgICAgIFwicHJvY19leGl0XCI6IHN5c2NhbGwoKFxuICAgICAgICBydmFsOiBudW1iZXIsXG4gICAgICApOiBuZXZlciA9PiB7XG4gICAgICAgIGlmICh0aGlzLiNleGl0T25SZXR1cm4pIHtcbiAgICAgICAgICBEZW5vLmV4aXQocnZhbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXhpdFN0YXR1cyhydmFsKTtcbiAgICAgIH0pLFxuXG4gICAgICBcInByb2NfcmFpc2VcIjogc3lzY2FsbCgoXG4gICAgICAgIF9zaWc6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIHJldHVybiBFUlJOT19OT1NZUztcbiAgICAgIH0pLFxuXG4gICAgICBcInNjaGVkX3lpZWxkXCI6IHN5c2NhbGwoKCk6IG51bWJlciA9PiB7XG4gICAgICAgIHJldHVybiBFUlJOT19TVUNDRVNTO1xuICAgICAgfSksXG5cbiAgICAgIFwicmFuZG9tX2dldFwiOiBzeXNjYWxsKChcbiAgICAgICAgYnVmZmVyT2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIGJ1ZmZlckxlbmd0aDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgdGhpcy4jbWVtb3J5LmJ1ZmZlcixcbiAgICAgICAgICBidWZmZXJPZmZzZXQsXG4gICAgICAgICAgYnVmZmVyTGVuZ3RoLFxuICAgICAgICApO1xuICAgICAgICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGJ1ZmZlcik7XG5cbiAgICAgICAgcmV0dXJuIEVSUk5PX1NVQ0NFU1M7XG4gICAgICB9KSxcblxuICAgICAgXCJzb2NrX3JlY3ZcIjogc3lzY2FsbCgoXG4gICAgICAgIF9mZDogbnVtYmVyLFxuICAgICAgICBfcmlEYXRhT2Zmc2V0OiBudW1iZXIsXG4gICAgICAgIF9yaURhdGFMZW5ndGg6IG51bWJlcixcbiAgICAgICAgX3JpRmxhZ3M6IG51bWJlcixcbiAgICAgICAgX3JvRGF0YUxlbmd0aE9mZnNldDogbnVtYmVyLFxuICAgICAgICBfcm9GbGFnc09mZnNldDogbnVtYmVyLFxuICAgICAgKTogbnVtYmVyID0+IHtcbiAgICAgICAgcmV0dXJuIEVSUk5PX05PU1lTO1xuICAgICAgfSksXG5cbiAgICAgIFwic29ja19zZW5kXCI6IHN5c2NhbGwoKFxuICAgICAgICBfZmQ6IG51bWJlcixcbiAgICAgICAgX3NpRGF0YU9mZnNldDogbnVtYmVyLFxuICAgICAgICBfc2lEYXRhTGVuZ3RoOiBudW1iZXIsXG4gICAgICAgIF9zaUZsYWdzOiBudW1iZXIsXG4gICAgICAgIF9zb0RhdGFMZW5ndGhPZmZzZXQ6IG51bWJlcixcbiAgICAgICk6IG51bWJlciA9PiB7XG4gICAgICAgIHJldHVybiBFUlJOT19OT1NZUztcbiAgICAgIH0pLFxuXG4gICAgICBcInNvY2tfc2h1dGRvd25cIjogc3lzY2FsbCgoXG4gICAgICAgIF9mZDogbnVtYmVyLFxuICAgICAgICBfaG93OiBudW1iZXIsXG4gICAgICApOiBudW1iZXIgPT4ge1xuICAgICAgICByZXR1cm4gRVJSTk9fTk9TWVM7XG4gICAgICB9KSxcbiAgICB9O1xuXG4gICAgdGhpcy4jc3RhcnRlZCA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHQgdG8gYmVnaW4gZXhlY3V0aW9uIG9mIGluc3RhbmNlIGFzIGEgY29tbWFuZCBieSBpbnZva2luZyBpdHNcbiAgICogX3N0YXJ0KCkgZXhwb3J0LlxuICAgKlxuICAgKiBJZiB0aGUgaW5zdGFuY2UgZG9lcyBub3QgY29udGFpbiBhIF9zdGFydCgpIGV4cG9ydCwgb3IgaWYgdGhlIGluc3RhbmNlXG4gICAqIGNvbnRhaW5zIGFuIF9pbml0aWFsaXplIGV4cG9ydCBhbiBlcnJvciB3aWxsIGJlIHRocm93bi5cbiAgICpcbiAgICogVGhlIGluc3RhbmNlIG11c3QgYWxzbyBoYXZlIGEgV2ViQXNzZW1ibHkuTWVtb3J5IGV4cG9ydCBuYW1lZCBcIm1lbW9yeVwiXG4gICAqIHdoaWNoIHdpbGwgYmUgdXNlZCBhcyB0aGUgYWRkcmVzcyBzcGFjZSwgaWYgaXQgZG9lcyBub3QgYW4gZXJyb3Igd2lsbCBiZVxuICAgKiB0aHJvd24uXG4gICAqL1xuICBzdGFydChpbnN0YW5jZTogV2ViQXNzZW1ibHkuSW5zdGFuY2UpOiBudWxsIHwgbnVtYmVyIHwgbmV2ZXIge1xuICAgIGlmICh0aGlzLiNzdGFydGVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXZWJBc3NlbWJseS5JbnN0YW5jZSBoYXMgYWxyZWFkeSBzdGFydGVkXCIpO1xuICAgIH1cblxuICAgIHRoaXMuI3N0YXJ0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgeyBfc3RhcnQsIF9pbml0aWFsaXplLCBtZW1vcnkgfSA9IGluc3RhbmNlLmV4cG9ydHM7XG5cbiAgICBpZiAoIShtZW1vcnkgaW5zdGFuY2VvZiBXZWJBc3NlbWJseS5NZW1vcnkpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiV2ViQXNlbWJseS5pbnN0YW5jZSBtdXN0IHByb3ZpZGUgYSBtZW1vcnkgZXhwb3J0XCIpO1xuICAgIH1cblxuICAgIHRoaXMuI21lbW9yeSA9IG1lbW9yeTtcblxuICAgIGlmICh0eXBlb2YgX2luaXRpYWxpemUgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIldlYkFzZW1ibHkuaW5zdGFuY2UgZXhwb3J0IF9pbml0aWFsaXplIG11c3Qgbm90IGJlIGEgZnVuY3Rpb25cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBfc3RhcnQgIT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIldlYkFzc2VtYmx5Lkluc3RhbmNlIGV4cG9ydCBfc3RhcnQgbXVzdCBiZSBhIGZ1bmN0aW9uXCIsXG4gICAgICApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBfc3RhcnQoKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFeGl0U3RhdHVzKSB7XG4gICAgICAgIHJldHVybiBlcnIuY29kZTtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHQgdG8gaW5pdGlhbGl6ZSBpbnN0YW5jZSBhcyBhIHJlYWN0b3IgYnkgaW52b2tpbmcgaXRzIF9pbml0aWFsaXplKCkgZXhwb3J0LlxuICAgKlxuICAgKiBJZiBpbnN0YW5jZSBjb250YWlucyBhIF9zdGFydCgpIGV4cG9ydCwgdGhlbiBhbiBleGNlcHRpb24gaXMgdGhyb3duLlxuICAgKlxuICAgKiBUaGUgaW5zdGFuY2UgbXVzdCBhbHNvIGhhdmUgYSBXZWJBc3NlbWJseS5NZW1vcnkgZXhwb3J0IG5hbWVkIFwibWVtb3J5XCJcbiAgICogd2hpY2ggd2lsbCBiZSB1c2VkIGFzIHRoZSBhZGRyZXNzIHNwYWNlLCBpZiBpdCBkb2VzIG5vdCBhbiBlcnJvciB3aWxsIGJlXG4gICAqIHRocm93bi5cbiAgICovXG4gIGluaXRpYWxpemUoaW5zdGFuY2U6IFdlYkFzc2VtYmx5Lkluc3RhbmNlKSB7XG4gICAgaWYgKHRoaXMuI3N0YXJ0ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIldlYkFzc2VtYmx5Lkluc3RhbmNlIGhhcyBhbHJlYWR5IHN0YXJ0ZWRcIik7XG4gICAgfVxuXG4gICAgdGhpcy4jc3RhcnRlZCA9IHRydWU7XG5cbiAgICBjb25zdCB7IF9zdGFydCwgX2luaXRpYWxpemUsIG1lbW9yeSB9ID0gaW5zdGFuY2UuZXhwb3J0cztcblxuICAgIGlmICghKG1lbW9yeSBpbnN0YW5jZW9mIFdlYkFzc2VtYmx5Lk1lbW9yeSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJXZWJBc2VtYmx5Lmluc3RhbmNlIG11c3QgcHJvdmlkZSBhIG1lbW9yeSBleHBvcnRcIik7XG4gICAgfVxuXG4gICAgdGhpcy4jbWVtb3J5ID0gbWVtb3J5O1xuXG4gICAgaWYgKHR5cGVvZiBfc3RhcnQgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIldlYkFzc2VtYmx5Lkluc3RhbmNlIGV4cG9ydCBfc3RhcnQgbXVzdCBub3QgYmUgYSBmdW5jdGlvblwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoX2luaXRpYWxpemUgJiYgdHlwZW9mIF9pbml0aWFsaXplICE9IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgXCJXZWJBc3NlbWJseS5JbnN0YW5jZSBleHBvcnQgX2luaXRpYWxpemUgbXVzdCBiZSBhIGZ1bmN0aW9uIG9yIG5vdCBiZSBkZWZpbmVkXCIsXG4gICAgICApO1xuICAgIH1cbiAgICBfaW5pdGlhbGl6ZT8uKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsdUNBQXVDO0FBRXZDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBc0VDLEdBRUQsU0FBUyxRQUFRLEVBQUUsT0FBTyxRQUFRLGlCQUFpQjtBQUVuRCxNQUFNLG1CQUFtQjtBQUN6QixNQUFNLG9CQUFvQjtBQUMxQixNQUFNLDZCQUE2QjtBQUNuQyxNQUFNLDRCQUE0QjtBQUVsQyxNQUFNLGdCQUFnQjtBQUN0QixNQUFNLGNBQWM7QUFDcEIsTUFBTSxjQUFjO0FBQ3BCLE1BQU0sa0JBQWtCO0FBQ3hCLE1BQU0scUJBQXFCO0FBQzNCLE1BQU0scUJBQXFCO0FBQzNCLE1BQU0sZUFBZTtBQUNyQixNQUFNLGlCQUFpQjtBQUN2QixNQUFNLGFBQWE7QUFDbkIsTUFBTSxnQkFBZ0I7QUFDdEIsTUFBTSxhQUFhO0FBQ25CLE1BQU0sa0JBQWtCO0FBQ3hCLE1BQU0sZUFBZTtBQUNyQixNQUFNLG9CQUFvQjtBQUMxQixNQUFNLG9CQUFv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