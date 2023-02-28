import { fileExists } from "./utils.ts"

// ffmpeg -i '/segments/0-107.y4m' -i 'encodes/0/1.webm' -lavfi libvmaf=log_fmt=json:log_path=analysis/0/1.json -f null /dev/null
export async function analyse(key: number, segment: number[], crf: number, segmentPath: string, outPath: string, retries = 0): Promise<void> {
    if (await fileExists(`analyses/${key}/${crf}.webm`)) {
        console.log(`Skipping analysing ${key} with crf ${crf} because file already exists`)
        return
    }

    await Deno.mkdir("analyses/" + key, { recursive: true }).catch(() => { })

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
            `${outPath}/${key}/${crf}.webm`,
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

        return analyse(key, segment, crf, segmentPath, outPath, retries + 1)
    }

    console.log(`analysing segment ${key} with crf ${crf} successful`)
}