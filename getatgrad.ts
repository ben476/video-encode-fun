import convexes from "./convexes/0.json" assert { type: "json" }

const lines = []

for (let i = 0; i < convexes.length - 1; i++) {
    const a = convexes[i]
    const b = convexes[i + 1]

    const grad = (b.vmaf - a.vmaf) / (b.bitrate - a.bitrate)

    lines.push([a.bitrate, a.vmaf, grad])
}

console.log(lines)