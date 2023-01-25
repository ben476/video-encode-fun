import { getSegment, removeSegment } from "./segments.ts"
import { fileExistsSync, fileExists, crfs, range } from "./utils.ts"
import { verifyScene } from "./video.ts"
import scene_pos from "./scenes.json" assert { type: "json" }

async function encodeSegmentCrf(key: number, crf: number, segmentBuffer: Uint8Array) {
    if (await fileExists(`encodes/${key}/${crf}.webm`)) {
        console.log(`Skipping encoding ${key} with crf ${crf} because file already exists`)
        return
    }

    const pSvt = Deno.run({
        cmd: [
            "./SvtAv1EncApp",
            "-i",
            `-`,
            "-b",
            `-`,
            "-w",
            "1920",
            "-h",
            "1080",
            "--fps",
            "23.98",
            "--lp",
            "8",
            "--rc",
            "0",
            "--qp",
            `${crf}`,
            "--preset",
            "12",
        ],
        stdout: "piped",
        stdin: "piped",
        // stderr: "piped",
    })

    console.log("Piping segment to svt, size:", segmentBuffer.length)

    let position = 0;

    // const segmentStream = new ReadableStream({})

    const segmentStream = new ReadableStream({
        type: "bytes",
        pull(controller) {
            if (position < segmentBuffer.length) {
                // console.log("Piping segment to svt, position:", position)
                const chunk = segmentBuffer.slice(position, position + 100000)
                position += 100000
                controller.enqueue(chunk)
            } else {
                console.log("Done piping segment to svt", position, segmentBuffer.length)
                controller.close()
            }
        }
    })

    segmentStream.pipeTo(pSvt.stdin.writable)

    // const ivfBuffer = await pSvt.output()

    // const writer = pSvt.stdin.writable.getWriter()

    // await writer.write(segmentBuffer)

    // ffmpeg -y -i - -c copy -an out.webm
    const pFfmpeg = Deno.run({
        cmd: [
            "ffmpeg",
            "-y",
            "-i",
            "-",
            "-c",
            "copy",
            "-an",
            `encodes/${key}/${crf}.webm`
        ],
        stdin: "piped",
        stdout: "piped",
        // stderr: "piped",
    })

    pSvt.stdout.readable.pipeTo(pFfmpeg.stdin.writable)

    const { code } = await pFfmpeg.status()

    if (code !== 0) {
        console.log(`Encoding segment ${key} with crf ${crf} failed`)

        console.log(new TextDecoder().decode(await pSvt.stderrOutput()))
        console.log(new TextDecoder().decode(await pFfmpeg.stderrOutput()))

        return
    }

    console.log(`Encoding segment ${key} with crf ${crf} successful`)
}

async function encodeSegments(startFrame: number, endFrame: number, encodingCrfs: number[] = [...crfs]) {
    console.log(`Extracting segment ${startFrame} to ${endFrame}`)

    const segment = await getSegment("video.mp4", startFrame, endFrame)

    console.log(`Encoding segment ${startFrame} to ${endFrame}`)

    try {
        await Deno.mkdir("encodes/" + startFrame)
    } catch (_e) {
        // ignore
    }

    const encodingPromises = range(0, 34).map(async () => {
        while (encodingCrfs.length > 0) {
            const crf = encodingCrfs.shift()

            if (!crf) {
                break
            }

            await encodeSegmentCrf(startFrame, crf, segment)
        }
    })

    await Promise.all(encodingPromises)

    console.log(`Encoding segment ${startFrame} to ${endFrame} complete`)

    removeSegment("video.mp4", startFrame)
}

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

    if (failed.length > 0)
        completed.splice(completed.indexOf(lastCompleted), 1)
}

const segmentsToEncode = scenes.filter(scene => completed.indexOf(scene) === -1)

for (let i = 0; i < segmentsToEncode.length; i++) {
    const segment = segmentsToEncode[i]
    // const nextSegment = segmentsToEncode[i + 1]
    // if (nextSegment)
    //     getSegment(nextSegment[0], segment[1])
    await encodeSegments(segment[0], segment[1])
}