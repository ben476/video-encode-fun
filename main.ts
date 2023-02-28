import { crfs } from "./utils.ts"
import { verify, verifyScenes } from "./verify.ts"
import scene_pos from "./scenes.json" assert { type: "json" }
import { encode } from "./encode.ts"
import { analyse } from "./analyse.ts"
import { SegmentLoader } from "./segments.ts"
import { getTaskStream, Task, createTaskRunners } from "./task.ts"
import { parse } from "https://deno.land/std@0.178.0/flags/mod.ts";

const task: Task = {
    "encode": encode,
    "analyse": analyse,
    "verify": async (_key: number, segment: number[], crf: number, _segmentPath: string, _outPath: string, _retries?: number) => { await verify(segment[0], segment[1], crf, flags.outPath) }
}[Deno.args[0]] || encode

const videoPath = Deno.args[1] || '/Users/benja/Downloads/vid_comp/video.mp4'

const flags = parse(Deno.args, {
    boolean: ["server"],
    string: ["runners", "cacheDir", "outPath"],
    alias: {
        s: "server",
        r: "runners"
    },
    default: {
        runners: "8",
        cacheDir: "segments",
        outPath: "encodes"
        // outPath: task === encode ? "encodes" : "analyses"
    }
})

const numRunners = Number(flags.runners)

console.log("Flags:", flags)

const scenes = scene_pos.map((a: number, i: number) => [a, scene_pos[i + 1] || 2147483647])
const started = (await Promise.all(scenes.map(async scene => await Deno.stat(`${flags.outPath}/${scene[0]}`).catch(() => { }) && scene))).filter(a => a) as number[][]
const encodeReg = /^\d+.webm$/
const completed = started.filter(scene => [...Deno.readDirSync(`${flags.outPath}/${scene[0]}`)].filter(file => encodeReg.test(file.name)).length === crfs.length)
const semiCompleted = started.filter(scene => !completed.includes(scene))

console.log("Scenes completed:", completed)
console.log("Scenes semi-completed:", semiCompleted)

const toVerify = [completed[completed.length - 1], ...semiCompleted].filter(a => a)
const toEncode = [...await verifyScenes(toVerify, flags.outPath), ...scenes.filter(scene => !completed.includes(scene))]
// const toEncode = []

console.log("Encode queue:", toEncode)

await Deno.mkdir("encodes").catch(() => { })

const encodeQueue = [...task === encode ? toEncode : scenes.filter(scene => !toEncode.includes(scene))].reverse()

if (flags.server) {
    const server = Deno.listen({ port: 8080 })

    for await (const conn of server) {
        const httpConn = Deno.serveHttp(conn)
        for await (const requestEvent of httpConn) {
            requestEvent.respondWith(new Response(JSON.stringify({ encodeQueue, completed, semiCompleted }), {
                headers: new Headers({
                    "content-type": "application/json"
                })
            }))
        }
    }
} else {
    const segmentLoader = task === encode ? new SegmentLoader(videoPath, flags.cacheDir) : null
    const taskStream = getTaskStream(segmentLoader, () => encodeQueue.pop(), task, numRunners, flags.outPath)
    const taskRunners = createTaskRunners(taskStream, numRunners)

    console.log("Running", taskRunners.length, "tasks")

    await Promise.all(taskRunners)

    console.log("Finished all tasks")

    segmentLoader?.cleanup()
}

Deno.exit(0)