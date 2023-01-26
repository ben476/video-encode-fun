import { fileExists, crfs, range } from "./utils.ts"

export async function encodeSegmentCrf(key: number, crf: number, segmentBuffer: Uint8Array) {
    if (await fileExists(`encodes/${key}/${crf}.webm`)) {
        console.log(`Skipping encoding ${key} with crf ${crf} because file already exists`)
        return
    }

    const pSvt = Deno.run({
        cmd: [
            "SvtAv1EncApp",
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

export async function encodeSegments(segmentBuffer: Uint8Array, startFrame: number, endFrame: number, encodingCrfs: number[] = [...crfs]) {
    console.log(`Extracting segment ${startFrame} to ${endFrame}`)

    console.log(`Encoding segment ${startFrame} to ${endFrame}`)

    try {
        await Deno.mkdir("encodes/" + startFrame)
    } catch (_e) {
        // ignore
    }

    const encodingPromises = range(0, 3).map(async () => {
        while (encodingCrfs.length > 0) {
            const crf = encodingCrfs.shift()

            if (!crf) {
                break
            }

            await encodeSegmentCrf(startFrame, crf, segmentBuffer)
        }
    })

    await Promise.all(encodingPromises)

    console.log(`Encoding segment ${startFrame} to ${endFrame} complete`)

    // removeSegment(video, startFrame)
}