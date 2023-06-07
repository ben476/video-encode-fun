import scene_pos from "./scenes.json" assert { type: "json" }

interface Point {
    crf: string,
    bitrate: number,
    filesize: number,
    vmaf: number,
    start: number,
    frames: number
}

const vmafCurves: Record<number, Point[]> = {}

for (const scene of scene_pos) {
    vmafCurves[scene] = JSON.parse(await Deno.readTextFile(`br-vmaf/${scene}.json`))
}

console.log(vmafCurves[0])

let csv = "crf,size,bitrate,vmaf"

for (let crf = 1; crf < 64; crf++) {
    let size = 0
    let vmafSum = 0

    for (const scene of scene_pos) {
        const point = vmafCurves[scene].find(point => point.crf === "" + crf)!
        size += point.filesize
        vmafSum += point.vmaf * point.frames
    }

    console.log(size, size / 34047 * 24 * 8, vmafSum / 34047)

    csv += `\n${crf},${size},${size / 34047 * 24 * 8},${vmafSum / 34047}`
}

await Deno.writeTextFile("crf-size-vmaf.csv", csv)