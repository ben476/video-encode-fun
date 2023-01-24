// command ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 test.mp4

const p = Deno.run({
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
        "test.webm",
    ],
    stdout: "piped",
    stderr: "piped",
})

const status = await p.status()

console.log(status)

const binaryOutput = await p.output()

console.log(binaryOutput)

const textDecoder = new TextDecoder()

const output = textDecoder.decode(binaryOutput)

const error = textDecoder.decode(await p.stderrOutput())

console.log(error)

console.log(output)

console.log(!!error)

const nFrames = Number(output)

console.log(nFrames)

p.close()