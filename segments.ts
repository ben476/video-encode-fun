interface VideoInfo {
    width: number
    height: number
    frames: number
    fpsDen: number
    fpsNum: number
}

export class SegmentLoader {
    segments: Record<number, Promise<string>> = {}
    segmenterPromises: Record<number, (value: string) => void> = {}
    textEncoder = new TextEncoder()
    process: Deno.Process
    stdin: Deno.Writer
    path: string
    outFolder: string
    videoInfo: Promise<VideoInfo>

    constructor(path: string, cacheDir = "segments") {
        this.path = path

        this.outFolder = cacheDir + "/" + encodeURIComponent(path)

        const p = Deno.run({
            cmd: [
                "./ffms-segmenter/target/release/ffms-test",
                path,
                this.outFolder
            ],
            stdin: "piped",
            stdout: "piped",
            // stderr: "piped",
        })

        this.process = p

        this.stdin = p.stdin;

        const buf = new Uint8Array(1024)

        this.videoInfo = p.stdout.read(buf).then((result) => {
            if (result === null) {
                throw new Error("Could not read video info")
            }

            const decoder = new TextDecoder()

            const [width, height, frames, fpsDen, fpsNum] = decoder.decode(buf).split(" ").map((s) => parseInt(s))

            return { width, height, frames, fpsDen, fpsNum }
        });

        (async () => {
            const decoder = new TextDecoder()

            try {
                for await (const chunk of p.stdout.readable) {
                    const [key, path] = decoder.decode(chunk).replace("\n", "").split(" ")

                    const segmenterPromise = this.segmenterPromises[parseInt(key)]

                    if (segmenterPromise) {
                        segmenterPromise(path)
                    } else {
                        console.log("No segmenter promise found for", key)
                        throw new Error("No segmenter promise found for " + key)
                    }
                }
            } catch (e) {
                console.log("Error reading from segmenter:", e)
            }
        })()
    }

    async getSegment(startFrame: number, endFrame: number): Promise<string> {
        const segments = this.segments

        segments[startFrame] ||= this.loadSegment(startFrame, endFrame)

        return await segments[startFrame]
    }

    async loadSegment(startFrame: number, endFrame: number): Promise<string> {
        console.log(`Getting segment ${startFrame} to ${endFrame} for ${this.path}`)

        await Deno.mkdir(this.outFolder, { recursive: true }).catch(() => { })

        await this.stdin.write(this.textEncoder.encode(`${startFrame} ${endFrame}\n`))

        const outPath = await new Promise<string>((resolve) => {
            if (this.segmenterPromises[startFrame]) {
                throw new Error("Already have a segmenter promise for " + startFrame)
            }

            this.segmenterPromises[startFrame] = resolve
        })

        return outPath
    }

    // removeSegment(startFrame: number) {
    //     console.log(`Removing segment ${ startFrame } for ${ this.path }`)
    //     // delete this.segments[startFrame]
    //     Deno.remove(`segments / ${ encodeURIComponent(this.path) } /${startFrame}.y4m`)
    // }

    cleanup() {
        this.process.kill()
        this.process.close()
        this.process.stdout?.close()

        Deno.remove(this.outFolder, { recursive: true }).catch(() => { })
    }
}