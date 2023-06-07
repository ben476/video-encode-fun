const quals: Record<string, number[]> = {}

for await (const file of Deno.readDir("analyses/107")) {
    if (file.name.endsWith(".json")) {
        const json = JSON.parse(await Deno.readTextFile("analyses/107/" + file.name))
        const crf = file.name.split(".")[0]
        quals[crf] = [(await Deno.stat(`encodes/107/${crf}.webm`)).size, json.pooled_metrics.vmaf.harmonic_mean]
    }
}

console.log("VMAFs:", quals)

const csv = "crf,filesize,vmaf\n" + Object.entries(quals).map(([crf, [size, vmaf]]) => `${crf},${size},${vmaf}`).join("\n")

await Deno.writeTextFile("csv/107.csv", csv)