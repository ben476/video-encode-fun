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
    vmafCurves[scene] = JSON.parse(await Deno.readTextFile(`convexes/${scene}.json`))
}

console.log(vmafCurves[0])

let csv = "grad,size,bitrate,vmaf"

const targetVmaf = 9
const targetGrad = 0.0001

// for (let targetGrad = 0.00001; targetGrad < 0.01; targetGrad += 0.00001) {
let size = 0
let vmafSum = 0

for (const scene of scene_pos) {
    const convexes = vmafCurves[scene]
    const lines = []

    for (let i = 0; i < convexes.length - 1; i++) {
        const a = convexes[i]
        const b = convexes[i + 1]

        const grad = (b.vmaf - a.vmaf) / (b.bitrate - a.bitrate)

        //

        lines.push([b.filesize, b.vmaf, grad, a.frames])
    }

    const closest = lines.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev[2] - targetGrad)
        const currDiff = Math.abs(curr[2] - targetGrad)

        return prevDiff < currDiff ? prev : curr
    })

    size += closest[0]
    vmafSum += closest[1] * closest[3]
}

console.log(targetGrad, size, size / 34047 * 24 * 8, vmafSum / 34047)

//     csv += `\n${targetGrad},${size},${size / 34047 * 24 * 8},${vmafSum / 34047}`
// }

// await Deno.writeTextFile("grad-size-vmaf.csv", csv)