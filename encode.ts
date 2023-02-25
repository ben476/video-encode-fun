import { fileExists, crfs, range } from "./utils.ts"

export async function encodeSegmentCrf(key: number, crf: number, segmentPath: string, retries = 0): Promise<void> {
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
            "--color-primaries",
            "bt709",
            "--transfer-characteristics",
            "bt709",
            "--matrix-coefficients",
            "bt709",
            "--lp",
            retries ? "32" : "1",
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

        // console.log(new TextDecoder().decode(await pSvt.stderrOutput()))
        // console.log(new TextDecoder().decode(await pFfmpeg.stderrOutput()))

        if (retries > 1) {
            return
        }

        return encodeSegmentCrf(key, crf, segmentPath, retries + 1)
    }

    console.log(`Encoding segment ${key} with crf ${crf} successful`)
}

export async function encodeSegments(segmentPath: string, startFrame: number, endFrame: number, encodingCrfs: number[] = [...crfs]) {
    // console.log(`Extracting segment ${startFrame} to ${endFrame}`)

    console.log(`Encoding segment ${startFrame} to ${endFrame}`)

    // try {
    //     await Deno.mkdir("encodes")
    // } catch (_e) {
    //     // ignore
    // }

    try {
        await Deno.mkdir("encodes/" + startFrame)
    } catch (_e) {
        // ignore
    }

    let remaining = encodingCrfs.length

    const encodingAsyncs = encodingCrfs.map((crf) => async () => {
        await encodeSegmentCrf(startFrame, crf, segmentPath)

        remaining--

        if (remaining === 0) {
            console.log(`Encoding segment ${startFrame} to ${endFrame} complete`)
            Deno.remove(segmentPath)
        }
    })

    // await Promise.all(encodingPromises)

    // console.log(`Encoding segment ${startFrame} to ${endFrame} complete`)

    // removeSegment(video, startFrame)

    return encodingAsyncs
}