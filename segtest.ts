import { getSegment, getSegmentOld } from "./segments.ts";

import { SegmentLoader } from "./segments.ts";

// const segment = await getSegment("/Users/benja/Downloads/vid_comp/video.mp4", 0, 100);
// const segmentOld = await getSegmentOld("/Users/benja/Downloads/vid_comp/video.mp4", 0, 100);

// console.log(segment.length, segmentOld.length);

// // make sure the segments have the same data
// for (let i = 0; i < segment.length; i++) {
//     if (segment[i] !== segmentOld[i]) {
//         console.log("Mismatch at", i);
//         break;
//     }
// }

const segmentLoader = new SegmentLoader("video.mp4")

await segmentLoader.initialise()

const segment = await segmentLoader.getSegment(99999999, 99999999)
// import { Readable } from "https://deno.land/std@0.173.0/node/stream.ts"

// const p = Deno.run({
//     cmd: [
//         "ffmpeg",
//         "-y",
//         "-i",
//         "video.mp4",
//         "-pix_fmt",
//         "yuv420p",
//         "-f",
//         "yuv4mpegpipe",
//         "-"
//     ],
//     stdout: "piped",
//     // stderr: "piped",
// })

// const stream = Readable.fromWeb(p.stdout.readable)

// // get number of bytes in whole stream

// let bytes = 0
// setInterval(() => {
//     console.log(bytes)
// }, 1000)

// for await (const chunk of stream) {
//     bytes += chunk.length
// }

// console.log(bytes)

// // 105899993150