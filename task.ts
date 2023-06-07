import { SegmentLoader } from "./segments.ts"
import { crfs, range } from "./utils.ts"

export type Task = (key: number, segment: number[], crf: number, segmentPath: string, outPath: string, retries?: number) => Promise<void>

export async function getSegmentTasks(segmentPath: string, key: number, segment: number[], task: Task, outPath: string, taskCrfs: number[] = [...crfs]) {
    console.log(`Running task for ${key}`)

    await Deno.mkdir("encodes/" + key, { recursive: true }).catch(() => { })

    let remaining = taskCrfs.length

    return taskCrfs.map((crf) => async () => {
        await task(key, segment, crf, segmentPath, outPath)

        remaining--

        if (remaining === 0) {
            console.log(`Encoding segment ${key}`)
            if (segmentPath) Deno.remove(segmentPath).catch(() => console.log("Failed to remove segment", segmentPath))
        }
    })
}

export function getTaskStream(segmentLoader: SegmentLoader | null, segmentGetter: () => (number[] | undefined), task: Task, numRunners: number, outPath: string, taskCrfs: number[] = [...crfs]) {
    return new ReadableStream({
        async pull(controller) {
            const segment = segmentGetter();
            if (segment) {
                const segmentPath = segmentLoader ? await segmentLoader.getSegment(segment[0], segment[1]) : "";
                const tasks = await getSegmentTasks(segmentPath, segment[0], segment, task, outPath, taskCrfs);

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