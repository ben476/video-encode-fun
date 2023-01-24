const scene_pos = [16464, 16563, 16643, 16691, 16745, 16933, 17082, 17096, 17296, 17379, 17468, 17677, 17760, 17868, 17995, 18066, 18119, 18226, 18417, 18491, 18557, 18565, 18652, 18708, 18725, 18742, 18775, 18846, 19115, 19231, 19254, 19314, 19416, 19469, 19579, 19620, 19660, 19735, 19742, 19794, 19806, 19842, 20091, 20126, 20161, 20176, 20184, 20204, 20276, 20347, 20461, 20509, 20664, 20795, 20866, 21116, 21134, 21188, 21274, 21321, 21452, 21511, 21522, 21667, 21703, 21775, 21846, 21905, 21961, 22007, 22058, 22084, 22131, 22349, 23122, 23338, 23441, 23568, 23689, 23725, 23880, 24077, 24124, 24357, 24428, 24476, 24581, 24592, 24641, 24658, 24698, 24713, 24733, 24924, 25007, 25078, 25109, 25176, 25191, 25304, 25540, 25615, 25692, 25970, 26060, 26303, 26314, 26389, 26401, 26484, 26591, 26773, 26869, 27003, 27146, 27277, 27390, 27473, 27617, 27733, 27759, 27959, 28066, 28136, 28161, 28226, 28297, 28350, 28383, 28517, 28708, 28803, 28922, 28987, 29041, 29232, 29273, 29279, 29319, 29502, 29538, 29642, 29755, 29833, 29856, 29951, 30131, 30191, 30274, 30294, 30456, 30467, 30635, 30704, 30829, 30867, 31161, 31178, 31304, 31447, 31536, 31620, 31709, 31756, 31820, 31894, 31933, 31963, 32047, 32271, 32364, 32641, 32772, 32781, 32813, 32852, 32939, 32948, 32965, 33354, 33485, 33544, 33603, 33927]

const scenes: number[][] = []

for (let i = 0; i < scene_pos.length - 1; i++) {
    scenes.push([scene_pos[i], scene_pos[i + 1]])
}


console.log("Scene frame cuts:", scenes)

function fileExistsSync(path: string) {
    try {
        Deno.statSync(path)
        return true
    } catch (e) {
        return false
    }
}

async function fileExists(path: string) {
    try {
        await Deno.stat(path)
        return true
    } catch (e) {
        return false
    }
}

const completed = scenes.filter(scene => fileExistsSync(`encodes/${scene[0]}`))

console.log("Completed scenes:", completed)

const lastCompleted = completed[completed.length - 1]

console.log("Last completed scene:", lastCompleted)

console.log("Ensure last completed scene has been encoded properly")

scenes.splice(scenes.indexOf(lastCompleted), 1)

const crfs = [...Array(63).keys()].map(a => a + 1)

const textDecoder = new TextDecoder()

let decodePromises = crfs.map(async crf => {
    if (!await fileExists(`encodes/${lastCompleted[0]}/${crf}.webm`)) {
        // console.log(`Decoding ${lastCompleted[0]} with crf ${crf} failed. File does not exist`)
        return crf
    }

    console.log(`Decoding ${lastCompleted[0]} with crf ${crf}`)

    // command: ffmpeg -i video.mp4 -vcodec copy -f null /dev/null 2>&1
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
            `encodes/${lastCompleted[0]}/${crf}.webm`,
        ],
        stdout: "piped",
        stderr: "piped",
    })

    const { code } = await p.status()

    if (code !== 0) {
        console.log(`Decoding ${lastCompleted[0]} with crf ${crf} failed. Deleting file and trying again`)
        await Deno.remove(`encodes/${lastCompleted[0]}/${crf}.webm`)
        return crf
    }

    // console.log(`Decoding ${lastCompleted[0]} with crf ${crf} successful, checking for correct length`)

    if (textDecoder.decode(await p.stderrOutput())) {
        console.log(`Decoding ${lastCompleted[0]} with crf ${crf} succeeded with errors. Deleting file and trying again`)
        await Deno.remove(`encodes/${lastCompleted[0]}/${crf}.webm`)
        return crf
    }

    const output = textDecoder.decode(await p.output())

    const nFrames = Number(output)

    if (nFrames !== lastCompleted[1] - lastCompleted[0]) {
        console.log(`Decoding ${lastCompleted[0]} with crf ${crf} succeeded, but had ${nFrames} frames instead of ${lastCompleted[1] - lastCompleted[0]}. Deleting file and trying again`)
        await Deno.remove(`encodes/${lastCompleted[0]}/${crf}.webm`)
        return crf
    }

    console.log(`Decoding ${lastCompleted[0]} with crf ${crf} successful`)

    p.close()
})

const failed = (await Promise.all(decodePromises)).filter(a => a).map(Number)

async function extractSegment(startFrame: number, endFrame: number) {
    const p = Deno.run({
        cmd: [
            "ffmpeg",
            "-y",
            "-i",
            "video.mp4",
            "-ss",
            `${startFrame / 23.98}`,
            "-to",
            `${endFrame / 23.98}`,
            "-pix_fmt",
            "yuv420p",
            `segments/${startFrame}.y4m`
        ],
        stdout: "piped",
        stderr: "piped",
    })

    const { code } = await p.status()

    if (code !== 0) {
        console.log(`Encoding segment ${startFrame} to ${endFrame} failed`)

        const stderr = textDecoder.decode(await p.stderrOutput())

        console.log(stderr)
        return
    }

    console.log(`Extracting segment ${startFrame} to ${endFrame} successful`)

    p.close()
}

async function encodeSegmentCrf(startFrame: number, endFrame: number, crf: number) {
    //SvtAv1EncApp -i snip.yuv -b stdout -w 1920 -h 1080 --fps 24 --rc 0 --qp 25 --preset 12
    const pSvt = Deno.run({
        cmd: [
            "SvtAv1EncApp",
            "-i",
            `segments/${startFrame}.y4m`,
            "-b",
            `stdout`,
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
            `encodes/${startFrame}/${crf}.webm`
        ],
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
    })

    pSvt.stdout.readable.pipeTo(pFfmpeg.stdin.writable)

    const { code } = await pFfmpeg.status()

    if (code !== 0) {
        console.log(`Encoding segment ${startFrame} to ${endFrame} with crf ${crf} failed`)
        return
    }

    console.log(`Encoding segment ${startFrame} to ${endFrame} with crf ${crf} successful`)
}

async function encodeSegments(startFrame: number, endFrame: number, encodingCrfs: number[] = [...crfs]) {
    console.log(`Extracting segment ${startFrame} to ${endFrame}`)

    await extractSegment(startFrame, endFrame)

    console.log(`Encoding segment ${startFrame} to ${endFrame}`)

    const encodingPromises = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(async () => {
        while (encodingCrfs.length > 0) {
            const crf = encodingCrfs.shift()

            if (!crf) {
                break
            }

            await encodeSegmentCrf(startFrame, endFrame, crf)
        }
    })

    await Promise.all(encodingPromises)

    console.log(`Encoding segment ${startFrame} to ${endFrame} complete`)

    await Deno.remove(`segments/${startFrame}.y4m`)
}

encodeSegments(lastCompleted[0], lastCompleted[1], failed)

const toEncode = scenes.filter(scene => completed.indexOf(scene) === -1)

for (const scene of toEncode) {
    await encodeSegments(scene[0], scene[1])
}