import { crfs, fileExistsSync, range } from "./utils.ts"
import { verifyScene } from "./video.ts"
import scene_pos from "./scenes.json" assert { type: "json" }
import { encodeSegments } from "./encode.ts"
import { analyseSegments } from "./analyse.ts"
import { SegmentLoader } from "./segments.ts"

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

    // scenes.splice(scenes.indexOf(lastCompleted), 1)

    const failed = await verifyScene(lastCompleted[0], lastCompleted[1])

    console.log("Failed scenes:", failed)

    if (failed.length !== 0)
        completed.splice(completed.indexOf(lastCompleted), 1)
}

console.log("Completed scenes:", completed)

const segmentsToEncode = scenes.filter(scene => !completed.includes(scene))
// const segmentsToEncode = completed

const segmentLoader = new SegmentLoader('/Users/benja/Downloads/vid_comp/video.mp4') // OK to cast since all methods are already async

// segmentLoader.getSegment(segmentsToEncode[0][0], segmentsToEncode[0][1])

try {
    await Deno.mkdir("encodes")
} catch (_e) {
    // ignore
}

const encodeQueue = [...segmentsToEncode].reverse()

const numRunners = 7

console.log("Segments to encode:", segmentsToEncode)

const taskStream = new ReadableStream({
    async pull(controller) {
        const segment = encodeQueue.pop()
        if (segment) {
            const segmentPath = await segmentLoader.getSegment(segment[0], segment[1])
            // await encodeSegments(segmentPath, segment[0], segment[1])
            const tasks = await encodeSegments(segmentPath, segment[0], segment[1])

            tasks.forEach(task => controller.enqueue(task))
        } else {
            console.log("Done")
            controller.close()
        }
    }
}, {
    highWaterMark: numRunners
}).getReader();

const taskRunners = range(0, numRunners).map(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10000))

    while (true) {
        // console.log("Reading task")
        const task = await taskStream.read()
        // console.log("Read task", task)
        if (task.done) break
        await task.value()
    }
})

console.log("Running", taskRunners.length, "tasks")
await Promise.all(taskRunners)

// for (let i = 0; i < segmentsToEncode.length; i++) {
//     const segment = segmentsToEncode[i]
//     const nextSegment = segmentsToEncode[i + 1]
//     if (nextSegment)
//         segmentLoader.getSegment(nextSegment[0], nextSegment[1])
//     const segmentPath = await segmentLoader.getSegment(segment[0], segment[1])
//     // await encodeSegments(segmentPath, segment[0], segment[1])
//     await analyseSegments(segmentPath, segment[0], segment[1])
//     // Deno.remove(segmentPath)
// }