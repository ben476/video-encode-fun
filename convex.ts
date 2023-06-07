interface Point {
    crf: string,
    bitrate: number,
    vmaf: number
}

const quals: Point[] = []

for await (const file of Deno.readDir("analyses/107")) {
    if (file.name.endsWith(".json")) {
        const json = JSON.parse(await Deno.readTextFile("analyses/107/" + file.name))
        const crf = file.name.split(".")[0]
        // quals[crf] = [(await Deno.stat(`encodes/107/${crf}.webm`)).size, json.pooled_metrics.vmaf.harmonic_mean]
        quals.push({
            crf: file.name.split(".")[0],
            bitrate: (await Deno.stat(`encodes/107/${crf}.webm`)).size,
            vmaf: json.pooled_metrics.vmaf.harmonic_mean
        })
    }
}

quals.sort((a, b) => a.bitrate - b.bitrate)

console.log(quals)

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

console.log(convexPoints)

const csv = "crf,bitrate,vmaf\n" + convexPoints.map(point => `${point.crf},${point.bitrate},${point.vmaf}`).join("\n")

await Deno.writeTextFile("convex.csv", csv)