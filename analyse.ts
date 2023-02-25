import { fileExists, crfs, range } from "./utils.ts"

// ffmpeg -i '/segments/0-107.y4m' -i 'encodes/0/1.webm' -lavfi libvmaf=log_fmt=json:log_path=analysis/0/1.json -f null /dev/null
export async function analyseSegmentCrf(key: number, crf: number, segmentPath: string, retries = 0): Promise<void> {
    if (await fileExists(`analyses/${key}/${crf}.webm`)) {
        console.log(`Skipping analysing ${key} with crf ${crf} because file already exists`)
        return
    }

    const pFfmpeg = Deno.run({
        cmd: [
            "ffmpeg",
            "-y",
            "-r",
            "23.98",
            "-i",
            segmentPath,
            "-r",
            "23.98",
            "-i",
            `encodes/${key}/${crf}.webm`,
            "-lavfi",
            `libvmaf=log_fmt=json:log_path=analyses/${key}/${crf}.json:n_threads=8`,
            "-f",
            "null",
            "/dev/null"
        ],
        stdin: "piped",
        stdout: "piped",
        // stderr: "piped",
    })

    const { code } = await pFfmpeg.status()

    if (code !== 0) {
        console.log(`analysing segment ${key} with crf ${crf} failed`)

        // console.log(new TextDecoder().decode(await pSvt.stderrOutput()))
        // console.log(new TextDecoder().decode(await pFfmpeg.stderrOutput()))

        if (retries > 1) {
            return
        }

        return analyseSegmentCrf(key, crf, segmentPath, retries + 1)
    }

    console.log(`analysing segment ${key} with crf ${crf} successful`)
}

export async function analyseSegments(segmentPath: string, startFrame: number, endFrame: number, analysingCrfs: number[] = [...crfs]) {
    // console.log(`Extracting segment ${startFrame} to ${endFrame}`)

    console.log(`analysing segment ${startFrame} to ${endFrame}`)

    try {
        await Deno.mkdir("analyses")
    } catch (_e) {
        // ignore
    }

    try {
        await Deno.mkdir("analyses/" + startFrame)
    } catch (_e) {
        // ignore
    }

    const analysingPromises = range(0, 64).map(async () => {
        while (analysingCrfs.length > 0) {
            const crf = analysingCrfs.shift()

            if (!crf) {
                break
            }

            await analyseSegmentCrf(startFrame, crf, segmentPath)
        }
    })

    await Promise.all(analysingPromises)

    console.log(`analysing segment ${startFrame} to ${endFrame} complete`)

    // removeSegment(video, startFrame)
}