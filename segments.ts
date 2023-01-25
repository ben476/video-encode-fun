import { Decoder, Encoder, Frame, Header } from './y4m.ts';
import { Readable } from "https://deno.land/std@0.173.0/node/stream.ts"
import { once } from "https://deno.land/std@0.173.0/node/events.ts"

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

const headers: Record<string, Header> = {}
// const streams: Record<string, Decoder> = {}
const segments: Record<string, Record<number, Uint8Array>> = {}
const iterators: Record<string, AsyncIterableIterator<Frame>> = {}
const frameNumbers: Record<string, number> = {}

export async function initialiseVideo(video: string) {
    if (headers[video] === undefined) {
        const stream = getY4MStream(video)

        const [header] = await once(stream, 'header')

        headers[video] = header
        // streams[video] = stream
        iterators[video] = stream[Symbol.asyncIterator]()
        frameNumbers[video] = 0

        console.log(`Initialised video ${video} with header`)
        console.log("YUV4MPEG2", header.toString())
    }
}

export async function getSegment(video: string, startFrame: number, endFrame: number): Promise<Uint8Array> {
    console.log(`Getting segment ${startFrame} to ${endFrame} for ${video}`)
    if (segments[video]?.[startFrame]) return segments[video][startFrame]

    // console.log(`Seeking to frame ${startFrame} for ${video}`)

    await initialiseVideo(video)

    if (startFrame < frameNumbers[video]) {
        throw new Error('Can only seek forward')
    }

    const iterator = iterators[video]

    console.log("Seeking to frame", startFrame, "from", frameNumbers[video])
    while (frameNumbers[video] < startFrame) {
        const { done } = await iterator.next()
        if (done) {
            throw new Error('Unexpected end of stream')
        }
        frameNumbers[video]++
    }

    const frames = []

    for (let i = startFrame; i < endFrame; i++) {
        const { value, done } = await iterator.next()
        if (done) {
            throw new Error('Unexpected end of stream')
        }
        frames.push(value)
    }

    frameNumbers[video] = endFrame

    const header = headers[video]

    const encoder = new Encoder({ header })

    for (const frame of frames) {
        encoder.write(frame)
    }

    encoder.end()

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

    for await (const chunk of encoder) {
        buffer.set(chunk, offset)
        offset += chunk.length
    }

    segments[video] ||= {}
    segments[video][startFrame] = buffer

    // await Deno.writeFile(`segments/${startFrame}.y4m`, buffer)

    return buffer
}

export function removeSegment(video: string, startFrame: number) {
    console.log(`Removing segment ${startFrame} for ${video}`)
    delete segments[video][startFrame]
}