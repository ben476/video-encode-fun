import { SegmentLoader } from "./segments.ts"
import { crfs, range } from "./utils.ts"

export type Task = (key: number, segment: number[], crf: number, segmentPath: string, retries?: number) => Promise<void>

export async function getSegmentTasks(segmentPath: string, key: number, segment: number[], task: (key: number, segment: number[], crf: number, segmentPath: string, retries?: number) => Promise<void>, encodingCrfs: number[] = [...crfs]) {
    console.log(`Running task for ${key}`)

    await Deno.mkdir("encodes/" + key).catch(() => { })

    let remaining = encodingCrfs.length

    return encodingCrfs.map((crf) => async () => {
        await task(key, segment, crf, segmentPath)

        remaining--

        if (remaining === 0) {
            console.log(`Encoding segment ${key}`)
            if (segmentPath) Deno.remove(segmentPath).catch(() => console.log("Failed to remove segment", segmentPath))
        }
    })
}

export function getTaskStream(segmentLoader: SegmentLoader | null, encodeQueue: number[][], task: Task, numRunners: number) {
    const encodeQueueReversed = [...encodeQueue].reverse();
    return new ReadableStream({
        async pull(controller) {
            const segment = encodeQueueReversed.pop();
            if (segment) {
                const segmentPath = segmentLoader ? await segmentLoader.getSegment(segment[0], segment[1]) : "";
                const tasks = await getSegmentTasks(segmentPath, segment[0], segment, task);

                tasks.forEach(task => controller.enqueue(task));
            } else {
                console.log("Done");
                controller.close();
            }
        }
    }, {
        highWaterMark: numRunners
    }).getReader();
}

export function createTaskRunners(taskStream: ReadableStreamDefaultReader<() => Promise<void>>, numRunners: number) {
    return range(0, numRunners).map(async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10000));

        while (true) {
            const task = await taskStream.read();
            if (task.done)
                break;
            await task.value();
        }
    });
}