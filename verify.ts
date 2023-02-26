import { createTaskRunners, getTaskStream } from "./task.ts"
import { fileExists, crfs } from "./utils.ts"

const textDecoder = new TextDecoder()

export async function verify(startFrame: number, endFrame: number, crf: number, outPath: string) {
    if (!await fileExists(`${outPath}/${startFrame}/${crf}.webm`)) {
        console.log(`Decoding ${startFrame} with crf ${crf} failed. File does not exist`)
        return crf
    }

    console.log(`Decoding ${startFrame} with crf ${crf}`)

    const p = await Deno.run({
        cmd: [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-count_frames",
            "-show_entries",
            "stream=nb_read_frames",
            "-of",
            "csv=p=0",
            `${outPath}/${startFrame}/${crf}.webm`,
        ],
        stdout: "piped",
        stderr: "piped",
    })

    const { code } = await p.status()

    if (code !== 0) {
        console.log(`Decoding ${startFrame} with crf ${crf} failed. Deleting file and trying again`)
        await Deno.remove(`${outPath}/${startFrame}/${crf}.webm`)
        return crf
    }

    // console.log(`Decoding ${startFrame} with crf ${crf} successful, checking for correct length`)

    if (textDecoder.decode(await p.stderrOutput())) {
        console.log(`Decoding ${startFrame} with crf ${crf} succeeded with errors. Deleting file and trying again`)
        await Deno.remove(`encodes/${startFrame}/${crf}.webm`)
        return crf
    }

    const output = textDecoder.decode(await p.output())

    const nFrames = Number(output)

    if (endFrame !== 2147483647 && nFrames !== endFrame - startFrame) {
        console.log(`Decoding ${startFrame} with crf ${crf} succeeded, but had ${nFrames} frames instead of ${endFrame - startFrame}. Deleting file and trying again`)
        await Deno.remove(`encodes/${startFrame}/${crf}.webm`)
        return crf
    }

    console.log(`Decoding ${startFrame} with crf ${crf} successful`)

    p.close()
}

export async function verifyScene(startFrame: number, endFrame: number, outPath: string) {
    const decodePromises = crfs.map((crf) => verify(startFrame, endFrame, crf, outPath))

    return (await Promise.all(decodePromises)).filter(a => a).map(Number)
}

export async function verifyScenes(toVerify: number[][], outPath: string) {
    console.log("Scenes to verify:", toVerify);

    const sceneVerifications: Record<number, number[]> = {};

    const segments = [...toVerify].reverse()

    const verificationTaskStream = getTaskStream(null, () => segments.pop(), async (key, segment, crf, _segmentPath, outPath, _retries) => {
        const result = await verify(segment[0], segment[1], crf, outPath);
        if (result) {
            sceneVerifications[key] ||= [];
            sceneVerifications[key].push(crf);
        }
    }, 8, outPath);

    const verificationTaskRunners = createTaskRunners(verificationTaskStream, 8);

    console.log("Running", verificationTaskRunners.length, "verification tasks");

    await Promise.all(verificationTaskRunners);

    console.log("Scene verifications:", sceneVerifications);

    return toVerify.filter(a => sceneVerifications[a[0]]?.length)
}