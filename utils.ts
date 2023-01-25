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

// export const crfs = [...Array(63).keys()].map(a => a + 1)

export const crfs = [21]