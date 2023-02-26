import { crfs } from "./utils.ts"
import { verify, verifyScenes } from "./verify.ts"
import scene_pos from "./scenes.json" assert { type: "json" }
import { encode } from "./encode.ts"
import { analyse } from "./analyse.ts"
import { SegmentLoader } from "./segments.ts"
import { getTaskStream, Task, createTaskRunners } from "./task.ts"

const numRunners = Number(Deno.args[1] || 8)
const task: Task = {
    "encode": encode,
    "analyse": analyse,
    "decode": async (_key: number, segment: number[], crf: number, _segmentPath: string, _retries?: number) => { await verify(segment[0], segment[1], crf) }
}[Deno.args[0]] || encode

const scenes = scene_pos.map((a: number, i: number) => [a, scene_pos[i + 1]]).filter((a: number[]) => a[1])
const started = (await Promise.all(scenes.map(async scene => await Deno.stat(`encodes/${scene[0]}`).catch(() => { }) && scene))).filter(a => a) as number[][]
const completed = started.filter(scene => [...Deno.readDirSync(`encodes/${scene[0]}`)].length === crfs.length)
const semiCompleted = started.filter(scene => !completed.includes(scene))

console.log("Scenes completed:", completed)
console.log("Scenes semi-completed:", semiCompleted)

const toVerify = [completed[completed.length - 1], ...semiCompleted].filter(a => a)
const encodeQueue = [...await verifyScenes(toVerify), ...scenes.filter(scene => !completed.includes(scene))]

console.log("Encode queue:", encodeQueue)

await Deno.mkdir("encodes").catch(() => { })

const segmentLoader = new SegmentLoader('/Users/benja/Downloads/vid_comp/video.mp4')
const taskStream = getTaskStream(segmentLoader, encodeQueue, task, numRunners)
const taskRunners = createTaskRunners(taskStream, numRunners)

console.log("Running", taskRunners.length, "tasks")

await Promise.all(taskRunners)

console.log("Finished all tasks")

segmentLoader.cleanup()
Deno.exit(0)