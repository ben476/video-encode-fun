const lockQueue: ((value: void | PromiseLike<void>) => void)[] = []

for (let i = 0; i < 10; i++) {
    (async () => {
        const lock = new Promise<void>(resolve => {
            lockQueue.push(resolve)
        })

        if (lockQueue.length > 1) {
            await lock
        }

        console.log("Lock acquired", i)

        await new Promise(resolve => setTimeout(resolve, 1000))

        // console.log("Lock released", i)

        lockQueue.shift()

        lockQueue[0]?.()

    })()
}

console.log("Done")