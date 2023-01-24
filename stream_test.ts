import { Decoder, Encoder } from './y4m.ts';
import { Readable, Writable } from 'https://deno.land/std/node/stream.ts'
import { once } from 'https://deno.land/std/node/events.ts'

const p = Deno.run({
    cmd: [
        "ffmpeg",
        "-y",
        "-i",
        "video.mp4",
        "-pix_fmt",
        "yuv420p",
        "-f",
        "yuv4mpegpipe",
        "-"
    ],
    stdout: "piped",
    stderr: "piped",
})

// const { code } = await p.status()

// console.log(code)

// const textDecoder = new TextDecoder()

// // const stderr = textDecoder.decode(await p.stderrOutput())


const outReader = p.stdout.readable

// convert to node readable

const outStreamNode = Readable.fromWeb(outReader)

// @ts-ignore
const decoder = outStreamNode.pipe(new Decoder())

const [header] = await once(decoder, 'header')

console.log(header);

// const outStream = new Readable()

// while (true) {
//     const { value, done } = await outStream.read()
//     console.log(new TextDecoder().decode(value))
//     // console.log(value)
//     // console.log(value?.length)
//     break
//     if (done) {
//         break
//     }
// }

for await (const frame of decoder) {
    console.log(frame);
    // await new Promise((resolve, reject) => setTimeout(resolve, 1000))
}

await new Promise((resolve, reject) => setTimeout(resolve, 100000))