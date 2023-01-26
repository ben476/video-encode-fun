import { fileExists, crfs, range } from "./utils.ts"

export async function encodeSegmentCrf(key: number, crf: number, segmentPath: string) {
    if (await fileExists(`encodes/${key}/${crf}.webm`)) {
        console.log(`Skipping encoding ${key} with crf ${crf} because file already exists`)
        return
    }

    const pSvt = Deno.run({
        cmd: [
            "SvtAv1EncApp",
            "-i",
            segmentPath,
            "-b",
            `/dev/stdout`,
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
        stderr: "piped",
    })

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
        stderr: "piped",
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

export async function encodeSegments(segmentPath: string, startFrame: number, endFrame: number, encodingCrfs: number[] = [...crfs]) {
    // console.log(`Extracting segment ${startFrame} to ${endFrame}`)

    console.log(`Encoding segment ${startFrame} to ${endFrame}`)

    try {
        await Deno.mkdir("encodes/" + startFrame)
    } catch (_e) {
        // ignore
    }

    const encodingPromises = range(0, 64).map(async () => {
        while (encodingCrfs.length > 0) {
            const crf = encodingCrfs.shift()

            if (!crf) {
                break
            }

            await encodeSegmentCrf(startFrame, crf, segmentPath)
        }
    })

    await Promise.all(encodingPromises)

    console.log(`Encoding segment ${startFrame} to ${endFrame} complete`)

    // removeSegment(video, startFrame)
}