import { fileExistsSync } from "./utils.ts"
import { verifyScene } from "./video.ts"
import scene_pos from "./scenes.json" assert { type: "json" }
import { encodeSegments } from "./encode.ts"
import { SegmentLoader } from "./segments.ts"
import { wrap } from "https://unpkg.com/comlink@4.3.1/dist/esm/comlink.mjs";

const scenes: number[][] = []

for (let i = 0; i < scene_pos.length - 1; i++) {
    scenes.push([scene_pos[i], scene_pos[i + 1]])
}


console.log("Scene frame cuts:", scenes)


const completed = scenes.filter(scene => fileExistsSync(`encodes/${scene[0]}`))

console.log("Completed scenes:", completed)

const lastCompleted = completed[completed.length - 1]

if (lastCompleted) {
    console.log("Last completed scene:", lastCompleted)

    console.log("Verifying last completed scene")

    scenes.splice(scenes.indexOf(lastCompleted), 1)

    const failed = await verifyScene(lastCompleted[0], lastCompleted[1])

    if (failed.length === 0)
        completed.splice(completed.indexOf(lastCompleted), 1)
}

const segmentsToEncode = scenes.filter(scene => completed.indexOf(scene) === -1)

const ComlinkSegmentLoader = wrap(new Worker(new URL("./segments.ts", import.meta.url).href, { type: "module" }))
const segmentLoader = await new ComlinkSegmentLoader("video.mp4") as SegmentLoader // OK to cast since all methods are already async

await segmentLoader.initialise()

segmentLoader.getSegment(segmentsToEncode[0][0], segmentsToEncode[0][1])

try {
    await Deno.mkdir("encodes")
} catch (_e) {
    // ignore
}

for (let i = 0; i < segmentsToEncode.length; i++) {
    const segment = segmentsToEncode[i]
    const nextSegment = segmentsToEncode[i + 1]
    if (nextSegment)
        segmentLoader.getSegment(nextSegment[0], nextSegment[1])
    const segmentPath = await segmentLoader.getSegment(segment[0], segment[1])
    await encodeSegments(segmentPath, segment[0], segment[1])
    Deno.remove(segmentPath)
}