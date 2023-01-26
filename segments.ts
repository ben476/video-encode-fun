import { Decoder, Encoder, Frame, Header } from './y4m.ts';
import { Readable } from "https://deno.land/std@0.173.0/node/stream.ts"
import { once } from "https://deno.land/std@0.173.0/node/events.ts"
import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

function getY4MStream(path: string) {
    const p = Deno.run({
        cmd: [
            "ffmpeg",
            "-y",
            "-i",
            path,
            "-pix_fmt",
            "yuv420p",
            "-f",
            "yuv4mpegpipe",
            "-"
        ],
        stdout: "piped",
        stderr: "piped",
    })

    const videoStream = Readable.fromWeb(p.stdout.readable)

    return videoStream.pipe(new Decoder())
}

export class SegmentLoader {
    frameNumber = 0
    segments: Record<number, Promise<Uint8Array>> = {}
    lockQueue: ((value: void | PromiseLike<void>) => void)[] = []
    iterator?: AsyncIterableIterator<Frame>
    header?: Header
    path: string

    constructor(path: string) {
        this.path = path
    }

    async initialise() {
        if (this.iterator && this.header) return

        const stream = getY4MStream(this.path)

        const [header] = await once(stream, 'header')

        this.header = header
        // streams[video] = stream
        this.iterator = stream[Symbol.asyncIterator]()
    }

    async getSegment(startFrame: number, endFrame: number): Promise<Uint8Array> {
        const segments = this.segments

        segments[startFrame] ||= this.loadSegment(startFrame, endFrame)

        return await segments[startFrame]
    }

    async loadSegment(startFrame: number, endFrame: number): Promise<Uint8Array> {
        console.log(`Getting segment ${startFrame} to ${endFrame} for ${this.path}`)

        const { iterator, header } = this

        // await this.initialise()

        if (!header || !iterator) {
            throw new Error('Video not initialised')
        }

        // get lock
        const lock = new Promise<void>(resolve => {
            this.lockQueue.push(resolve)
        })

        if (this.lockQueue.length > 1) {
            await lock
        }

        const releaseLock = () => {
            this.lockQueue.shift()
            this.lockQueue[0]?.()
        }

        console.log(`Seeking to frame ${startFrame} from ${this.frameNumber}`)

        if (startFrame < this.frameNumber) {
            throw new Error('Can only seek forward')
        }

        while (this.frameNumber < startFrame) {
            const { done } = await iterator.next()
            if (done) {
                throw new Error('Unexpected end of stream')
            }
            this.frameNumber++
        }

        console.log(`Decoding segment ${startFrame} to ${endFrame} for ${this.path}`)

        const frames = []

        for (let i = startFrame; i < endFrame; i++) {
            const { value, done } = await iterator.next()
            if (done) {
                throw new Error('Unexpected end of stream')
            }
            frames.push(value)
        }

        this.frameNumber = endFrame

        console.log(`Reconstructing segment ${startFrame} to ${endFrame} for ${this.path}`)

        let bufferSize = 0

        bufferSize += "YUV4MPEG2 ".length
        bufferSize += header.toString().length + 1

        for (const frame of frames) {
            bufferSize += "FRAME".length
            bufferSize += frame.rawParameters?.length || 0 + 1
            bufferSize += header.colourSpace.frameSize
        }

        const buffer = new Uint8Array(bufferSize)

        let offset = 0

        const textEncoder = new TextEncoder()

        function appendToBuffer(data: string | ArrayBuffer) {
            if (typeof data === "string") {
                data = textEncoder.encode(data)
            }
            buffer.set(new Uint8Array(data), offset)
            offset += data.byteLength
        }

        appendToBuffer("YUV4MPEG2 ")
        appendToBuffer(header.toString())
        appendToBuffer("\n")

        for (const frame of frames) {
            appendToBuffer("FRAME")
            appendToBuffer(frame.rawParameters || "")
            appendToBuffer("\n")
            appendToBuffer(frame.data)
        }

        // await Deno.writeFile(`segments/${startFrame}.y4m`, buffer)

        console.log(`Loaded segment ${startFrame} to ${endFrame} for ${this.path}`)

        releaseLock()

        return buffer
    }

    removeSegment(startFrame: number) {
        console.log(`Removing segment ${startFrame} for ${this.path}`)
        delete this.segments[startFrame]
    }
}

Comlink.expose(SegmentLoader)