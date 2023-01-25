import { fileExists, crfs } from "./utils.ts"

const textDecoder = new TextDecoder()

async function verifyCrf(startFrame: number, endFrame: number, crf: number) {
    if (!await fileExists(`encodes/${startFrame}/${crf}.webm`)) {
        // console.log(`Decoding ${startFrame} with crf ${crf} failed. File does not exist`)
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
            `encodes/${startFrame}/${crf}.webm`,
        ],
        stdout: "piped",
        stderr: "piped",
    })

    const { code } = await p.status()

    if (code !== 0) {
        console.log(`Decoding ${startFrame} with crf ${crf} failed. Deleting file and trying again`)
        await Deno.remove(`encodes/${startFrame}/${crf}.webm`)
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

    if (nFrames !== endFrame - startFrame) {
        console.log(`Decoding ${startFrame} with crf ${crf} succeeded, but had ${nFrames} frames instead of ${endFrame - startFrame}. Deleting file and trying again`)
        await Deno.remove(`encodes/${startFrame}/${crf}.webm`)
        return crf
    }

    console.log(`Decoding ${startFrame} with crf ${crf} successful`)

    p.close()
}

export async function verifyScene(startFrame: number, endFrame: number) {
    const decodePromises = crfs.map((crf) => verifyCrf(startFrame, endFrame, crf))

    return (await Promise.all(decodePromises)).filter(a => a).map(Number)
}