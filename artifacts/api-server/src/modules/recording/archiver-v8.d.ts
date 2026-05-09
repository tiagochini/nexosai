declare module "archiver" {
  import { Transform } from "node:stream";

  interface ZipOptions {
    zlib?: { level?: number };
    forceLocalTime?: boolean;
  }

  class Archiver extends Transform {
    append(source: string | Buffer | NodeJS.ReadableStream, data: { name: string }): this;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    finalize(): Promise<void>;
    pointer(): number;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: ZipOptions);
  }

  export class TarArchive extends Archiver {
    constructor(options?: Record<string, unknown>);
  }

  export { Archiver };
}
