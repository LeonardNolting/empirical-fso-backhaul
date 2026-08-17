import {child, get, ref, set} from "firebase/database";
import {changes, inputDirectory, type Persistence, setChange, type Tower, towers, type TowerWithoutInfo} from "./main";

export function readCSV(text: string, separator: string = ","): string[][] {
    const lines: any[][] = []
    for (const line of text.split('\n').slice(1)) {
        if (line.replace(/\s/g, '') === "") continue
        lines.push(line.split(separator))
    }
    return lines
}

export async function readInput(path: string, include_information: true): Promise<Tower[]>
export async function readInput(path: string, include_information?: false): Promise<TowerWithoutInfo[]>
export async function readInput(path: string, include_information: boolean = false): Promise<TowerWithoutInfo[]> {
    const response = await fetch(path);
    const text = await response.text();
    if (!text.split('\n')[0].startsWith("date,line,tile_id,lon,lat,height"))
        throw new Error(`CSV file at \`${path}\` had unexpected format.`)
    return readCSV(text).map(([database_date, database_line, tile_id, lng, lat, altitude, nature], i) => ({
        database_date,
        database_line: Number(database_line),
        tile_id,
        altitude: Number(altitude),
        index: i,
        lat: Number(lat),
        lng: Number(lng),
        ...include_information ? {
            nature: Number(nature),
        } : {}
    }))
}

export function serializeChanges() {
    const changeLines = changes.filter(change => change !== undefined).map((change, index) => {
        const tower = towers[index]
        const values = [
            tower.database_date,
            tower.database_line,
        ]
        if (change === false) values.push("false")
        else values.push(change.lng, change.lat, change.altitude)
        return values.join(",")
    })
    return [
        ["date", "line", "lon", "lat", "height"].join(","),
        ...changeLines
    ].join("\n")
}

export function readOutputIntoChanges(towers: Tower[], text: string) {
    const towers_by_line: { [line: number]: Tower } = {}
    towers.forEach(tower => towers_by_line[tower.database_line] = tower)

    const parsed_changes = readCSV(text)

    if (parsed_changes.length > towers.length) {
        throw Error("Error parsing previous changes: Output file contained more changes than current batch of towers.")
    }

    let parsed_changes_indices: number[] = []
    parsed_changes.forEach(([database_date, database_line_string, ...change_values]) => {
        const database_line = Number(database_line_string)
        if (!(database_line in towers_by_line)) {
            // Ignore so that one changes file can be used for multiple batches
            // throw Error("Error parsing previous changes: Output file contained changes for towers that are not in current batch.")

            return
        }

        if (towers_by_line[database_line]!.database_date !== database_date) {
            throw Error("Error parsing previous changes: Database dates do not match current batch.")
        }

        const index = towers_by_line[database_line]!.index

        if (change_values[0] === "false") {
            setChange(index, false, false)
        } else if (change_values[0] === "undefined") {
            return
        } else {
            const [lng, lat, altitude] = change_values.map(Number)
            setChange(index, {lng, lat, deltaAltitude: altitude}, false)
        }

        parsed_changes_indices.push(index)
    })

    console.log(`Parsed ${parsed_changes_indices.length} previous changes for indices ${parsed_changes_indices.join(", ")}.`)

    return parsed_changes_indices
}

export async function retrievePreviousChangesText(persistence: Persistence, batch: number): Promise<number[]> {
    let content = ""
    if (persistence.type === "local") {
        const output = await (await persistence.handle.getDirectoryHandle(inputDirectory, {create: true})).getFileHandle(`${batch}.csv`, {create: true})
        content = await (await output.getFile()).text()
    } else {
        await get(child(ref(persistence.database), `changes/${inputDirectory}/${persistence.user.uid}/batches/${batch}`)).then((snapshot) => {
            if (snapshot.exists()) content = snapshot.val() as string
        }).catch(console.error);
    }
    return readOutputIntoChanges(towers, content)
}

export async function persistChanges(persistence: Persistence, batch: number, contents: string) {
    if (persistence.type === "local") {
        const output = await (await persistence.handle.getDirectoryHandle(inputDirectory, {create: true})).getFileHandle(`${batch}.csv`, {create: true})
        const writable = await output.createWritable();
        await writable.write(contents);
        await writable.close();
    } else {
        await set(ref(persistence.database, `changes/${inputDirectory}/${persistence.user.uid}/batches/${batch}`), contents);
    }
}
