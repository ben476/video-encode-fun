import { spawn } from "child_process";

// list of ip addresses
const hosts = []

const workers = hosts.map((host, i) => {
    const cmd = spawn("ssh", [host, 'killall "/usr/pkg/bin/python3.9"']);
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

