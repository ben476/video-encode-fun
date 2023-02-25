import { crfs, fileExistsSync, range } from "./utils.ts"
import { verifyScene, verify } from "./verify.ts"
import scene_pos from "./scenes.json" assert { type: "json" }
import { encode } from "./encode.ts"
import { analyse } from "./analyse.ts"
import { SegmentLoader } from "./segments.ts"
import { getSegmentTasks, runSegmentTasks, Task } from "./task.ts"

const numRunners = Number(Deno.args[1] || 8)

const scenes: number[][] = []

for (let i = 0; i < scene_pos.length - 1; i++) {
    scenes.push([scene_pos[i], scene_pos[i + 1]])
}

// console.log("Scene frame cuts:", scenes)

const started = scenes.filter(scene => {
    try {
        Deno.statSync(`encodes/${scene[0]}`)
        return true
    } catch (_e) {
        return false
    }
})

const completed = started.filter(scene => [...Deno.readDirSync(`encodes/${scene[0]}`)].length === crfs.length)

const semiCompleted = started.filter(scene => !completed.includes(scene))

console.log("Scenes started:", started)
console.log("Scenes completed:", completed)
console.log("Scenes semi-completed:", semiCompleted)

const toVerify = [completed[completed.length - 1], ...semiCompleted].filter(a => a).reverse()

console.log("Scenes to verify:", toVerify)

const sceneVerifications: Record<number, number[]> = {}

await runSegmentTasks(null, toVerify, async (key, segment, crf, _segmentPath, _retries) => {
    const result = await verify(segment[0], segment[1], crf)
    if (result) {
        sceneVerifications[key] ||= []
        sceneVerifications[key].push(crf)
    }
}, 8)

console.log("Scene verifications:", sceneVerifications)

const encodeQueue = scenes.filter(scene => !completed.includes(scene)).reverse()

for (const scene of toVerify)
    if (sceneVerifications[scene[0]]?.length)
        encodeQueue.push(scene)

console.log("Encode queue:", [...encodeQueue].reverse())

const segmentsToEncode = scenes.filter(scene => !completed.includes(scene))
const segmentLoader = new SegmentLoader('/Users/benja/Downloads/vid_comp/video.mp4') // OK to cast since all methods are already async

try {
    await Deno.mkdir("encodes")
} catch (_e) {
    // ignore
}

const task: Task = {
    "encode": encode,
    "analyse": analyse,
    "decode": async (_key: number, segment: number[], crf: number, _segmentPath: string, _retries?: number) => { await verify(segment[0], segment[1], crf) }
}[Deno.args[0]] || encode

console.log("Segments to encode:", segmentsToEncode)

await runSegmentTasks(segmentLoader, encodeQueue, task, numRunners)

console.log("Finished all tasks")

segmentLoader.cleanup()

Deno.exit(0)

