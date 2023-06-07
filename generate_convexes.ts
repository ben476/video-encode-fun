import { SegmentLoader } from "./segments.ts"
import scene_pos from "./scenes.json" assert { type: "json" }

const segmentLoader = new SegmentLoader('/Users/benja/Downloads/vid_comp/video.mp4')
const videoInfo = await segmentLoader.videoInfo

console.log("Video info:", videoInfo)

const scenes = scene_pos.map((a: number, i: number) => [a, scene_pos[i + 1] || videoInfo.frames])

await Promise.all(scenes.map(async scene => {
    interface Point {
        crf: string,
        bitrate: number,
        filesize: number,
        vmaf: number,
        start: number,
        frames: number
    }

    const quals: Point[] = []

    for await (const file of Deno.readDir(`analyses/${scene[0]}`)) {
        if (file.name.endsWith(".json")) {
            const json = JSON.parse(await Deno.readTextFile(`analyses/${scene[0]}/${file.name}`))
            const crf = file.name.split(".")[0]
            const frames = scene[1] - scene[0]
            const filesize = (await Deno.stat(`encodes/${scene[0]}/${crf}.webm`)).size
            quals.push({
                crf: file.name.split(".")[0],
                bitrate: filesize / frames * videoInfo.fpsNum / videoInfo.fpsDen,
                filesize,
                vmaf: json.pooled_metrics.vmaf.harmonic_mean,
                start: scene[0],
                frames
            })
        }
    }

    quals.sort((a, b) => a.bitrate - b.bitrate)

    // console.log(quals)

    const convexPoints = [quals[0]]

    let qualityI = 0

    while (qualityI <= 64) {
        const quality = quals[qualityI]

        let maxPoint = quality
        let maxGrad = 0

        for (let i = Number(qualityI) + 1; i < quals.length; i++) {
            const newQual = quals[i]
            const grad = (newQual.vmaf - quality.vmaf) / (newQual.bitrate - quality.bitrate)

            if (grad > maxGrad) {
                maxPoint = newQual
                maxGrad = grad
            }
        }

        if (maxPoint === quality) break

        convexPoints.push(maxPoint)

        qualityI = quals.indexOf(maxPoint)
    }

    // console.log(convexPoints)

    const csv = "crf,filesize,bitrate,vmaf\n" + convexPoints.map(point => `${point.crf},${point.filesize},${point.bitrate},${point.vmaf}`).join("\n")

    await Deno.writeTextFile(`convexes/${scene[0]}.csv`, csv)

    // await Deno.writeTextFile(`br-vmaf/${scene[0]}.json`, JSON.stringify(quals))

    await Deno.writeTextFile(`convexes/${scene[0]}.json`, JSON.stringify(convexPoints))
}))

console.log("Done")
segmentLoader.cleanup()