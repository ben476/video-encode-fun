import { fileExistsSync } from "./utils.ts"
import { verifyScene } from "./video.ts"
import scene_pos from "./scenes.json" assert { type: "json" }
import { encodeSegments } from "./encode.ts"


const scenes: number[][] = []

for (let i = 0; i < scene_pos.length - 1; i++) {
    scenes.push([scene_pos[i], scene_pos[i + 1]])
}


console.log("Scene frame cuts:", scenes)


const completed = scenes.filter(scene => fileExistsSync(`encodes/${scene[0]}`))

console.log("Completed scenes:", completed)

const lastCompleted = completed[completed.length - 1]

if (lastCompleted) {
    console.log("Last completed scene:", lastCompleted)

    console.log("Verifying last completed scene")

    scenes.splice(scenes.indexOf(lastCompleted), 1)

    const failed = await verifyScene(lastCompleted[0], lastCompleted[1])

    if (failed.length === 0)
        completed.splice(completed.indexOf(lastCompleted), 1)
}

const segmentsToEncode = scenes.filter(scene => completed.indexOf(scene) === -1)

for (let i = 0; i < segmentsToEncode.length; i++) {
    const segment = segmentsToEncode[i]
    // const nextSegment = segmentsToEncode[i + 1]
    // if (nextSegment)
    //     getSegment(nextSegment[0], segment[1])
    await encodeSegments("/Users/benja/Downloads/vid_comp/video.mp4", segment[0], segment[1])
}