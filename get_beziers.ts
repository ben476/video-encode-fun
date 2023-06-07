import fitCurve from "npm:fit-curve"
import { Bezier } from "npm:bezier-js";
import convex from "./convexes/0.json" assert { type: "json" }

const points = convex.map(point => [point.bitrate, point.vmaf])

const curve = fitCurve(points, 3)

console.log(curve)

console.log(Bezier)

// const foo = new Bezier.PolyBezier(curve.map(a => new Bezier(...a.flat())))

const curves = curve.map(a => new Bezier(...a.flat()))

const bezPoints = []

for (const curve of curves) {
    for (let i = 0; i < 1; i += 0.05) {
        bezPoints.push(curve.get(i))
    }
}

console.log(bezPoints)

const  csv = "bitrate,vmaf\n" + bezPoints.map(point => `${point.x},${point.y}`).join("\n")

await Deno.writeTextFile("beziers.csv", csv)