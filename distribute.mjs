import { spawn } from "child_process";

// const hosts = ["the-front-page", "kahlos", "lambton", "fuel", "alley-cat", "axolotl", "flying-burrito-brothers", "la-normandie", "city-limits", "tulsi", "revive", "the-vault", "steamboat", "blue-penguin", "daawat", "stout", "green-parrot", "bistro-breton", "rhythm", "rama-thai", "quayside", "copperhead", "tasting-room", "oriental", "fidels", "big-thumb", "paris-emporium", "quo-vadis", "saffron", "clarks", "fyber", "purple-onion", "blondinis", "shamiana", "globe"]
const hosts = [
    "the-front-page",
    "kahlos",
    "lambton",
    "fuel",
    "alley-cat",
    "axolotl",
    "flying-burrito-brothers",
    "la-normandie",
    "city-limits",
    "tulsi",
    "revive",
    "the-vault",
    "steamboat",
    "blue-penguin",
    "daawat",
    "stout",
    "green-parrot",
    "bistro-breton",
    "rhythm",
    "rama-thai",
    "quayside",
    "copperhead",
    "tasting-room",
    "oriental",
    "fidels"
]
// const hosts = [
//     'flying-burrito-brothers',
//     'revive',
//     'steamboat',
//     'indus',
//     'daawat',
//     'green-parrot',
//     'clarks',
//     'rama-thai',
//     'cafe-minnow',
//     'rhythm',
//     'liquidate',
//     'climie',
//     'bistro-breton'
// ]

const workers = hosts.map((host, i) => {
    const cmd = spawn("ssh", ["-o", "StrictHostKeyChecking=no", host, "/usr/pkg/bin/node main.mjs " + i]);
    cmd.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    cmd.stderr.on('data', (data) => {
        console.log(data.toString());
    });
    cmd.on('close', (code) => {
        console.log(`${host} exited with code ${code}`);
    });
    return new Promise((resolve, reject) => {
        cmd.on('close', (code) => {
            console.log(`${host} exited with code ${code}`);
            resolve(code);
        });
    });
});

await Promise.all(workers)

console.log("All workers finished");

