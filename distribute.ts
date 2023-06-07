const hosts = ["fiebigs",
    "sakura",
    "uncle-changs",
    "vista",
    "kopi",
    "lumiere",
    "cafe-bodega",
    "espressoholic",
    "cafe-baba",
    "serranos",
    "malacca",
    "halswell",
    "cannibal-espresso",
    "cenotaph",
    "wholly-bagels",
    "ostro"]

const decoder = new TextDecoder()

const sshPromises = hosts.map(async (ip) => {
    const p = Deno.run({
        cmd: ["sshpass", "-p", "shakeme", "ssh", "-y", "-o", "StrictHostKeyChecking=no", "myshake@" + ip, "whoami"],
        stdout: "piped"
    })

    return [ip, await p.status(), decoder.decode(await p.output())] as [string, Deno.ProcessStatus, string]
})

const failed = (await Promise.all(sshPromises)).filter(a => a[1].code !== 0).map(a => a[0])

console.log("Failed addresses:", failed)