export function fileExistsSync(path: string) {
    try {
        Deno.statSync(path)
        return true
    } catch (_e) {
        return false
    }
}

export async function fileExists(path: string) {
    try {
        await Deno.stat(path)
        return true
    } catch (_e) {
        return false
    }
}

export function range(start: number, end: number) {
    return [...Array(end - start).keys()].map(a => a + start)
}

export const crfs = range(1, 64)

// export const crfs = [21]