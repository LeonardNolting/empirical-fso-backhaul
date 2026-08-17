import {persistChanges, readInput, retrievePreviousChangesText, serializeChanges} from "./files";
import './style.css'

// Street-view icons created by juicy_fish - Flaticon
// https://www.flaticon.com/free-icons/street-view
import streetViewMan from '/calibrator/street-view.png'

import {importLibrary, setOptions} from "@googlemaps/js-api-loader";
import {initializeApp} from "firebase/app";

import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    type Unsubscribe,
    type User
} from 'firebase/auth';
import {type Database, getDatabase} from 'firebase/database';
import {del as idb_del, get as idb_get, set as idb_set} from "idb-keyval";
import natures from "./natures";

const url = new URL(window.location.href);

function navigateToBatch(batch: number) {
    url.searchParams.set("batch", batch.toString());
    window.location.replace(url.toString());
}

// Default to first batch
if (!url.searchParams.has("batch")) {
    navigateToBatch(0);
    console.assert(false, "This statement should never be reached after reloading the page.")
}

// Default to first batch
if (!url.searchParams.has("input")) {
    url.searchParams.set("input", "tower");
    window.location.replace(url.toString());
    console.assert(false, "This statement should never be reached after reloading the page.")
}

const firebaseConfig = {
    apiKey: "AIzaSyCniq5V9gkJtF9hHQHxENzcMtVfspSu_80",
    authDomain: "cellfso.firebaseapp.com",
    databaseURL: "https://cellfso-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "cellfso",
    storageBucket: "cellfso.firebasestorage.app",
    messagingSenderId: "688468357413",
    appId: "1:688468357413:web:ccace83f250c979edd6acc"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth();

let current = 0

// Get batch
const batch = Number(url.searchParams.get("batch")!)

export const inputDirectory = url.searchParams.get("input")!
const inputFile = `calibrator/csv/${inputDirectory}/${batch}.csv`
export const towers = await readInput(inputFile, true);

// Load all towers for proximity search
const allTowers = await readInput('calibrator/csv/towers.csv', false);

const streetViewResponses: (Promise<google.maps.StreetViewResponse> | undefined)[] = Array(towers.length).fill(undefined)

let getStoredHandle: () => Promise<FileSystemDirectoryHandle | undefined> = () => idb_get('changes-handle');

export type Persistence = { type: "account", user: User, database: Database } | {
    type: "local",
    handle: FileSystemDirectoryHandle
};

document.getElementById('google-button')!.addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider())
});


async function checkDirectoryAccess(handle: FileSystemDirectoryHandle | undefined) {
    if (!handle) return false;

    let permission: PermissionState;
    try {
        permission = await handle.requestPermission({mode: 'readwrite'});
        if (permission === 'granted') return true;
    } catch (e) {
    }
    return false;
}

const persistence = await new Promise<Persistence>(async resolve => {

    const initialLocalCheck = await new Promise<Persistence | null>(resolve => {
        getStoredHandle().then(storedHandle =>
            checkDirectoryAccess(storedHandle).then(result => {
                if (result) resolve({handle: storedHandle!, type: "local"});
                else resolve(null)
            }).finally(() => resolve(null))).finally(() => resolve(null))
    })
    if (initialLocalCheck) return resolve(initialLocalCheck)

    let initialAuthStateChangedUnsubscribe: Unsubscribe | null = null;
    const initialAccountCheck = await new Promise<Persistence | null>(resolve => {
        initialAuthStateChangedUnsubscribe = onAuthStateChanged(auth, user => {
            if (user) resolve({type: "account", user, database: getDatabase()});
            else resolve(null)
        })
    })
    if (initialAuthStateChangedUnsubscribe) { // @ts-ignore
        initialAuthStateChangedUnsubscribe()
    }
    if (initialAccountCheck) return resolve(initialAccountCheck);

    document.body.classList.remove('loading')

    initialAuthStateChangedUnsubscribe = onAuthStateChanged(auth, user => {
        if (user) resolve({type: "account", user, database: getDatabase()})
    })

    const chooseDirectoryButton = document.getElementById("choose-directory")!
    chooseDirectoryButton.addEventListener("click", async event => {
        console.log("Clicked choose directory")
        const storedHandle = await getStoredHandle()
        console.log("Stored handle", storedHandle)
        if (storedHandle) {
            if (await storedHandle.requestPermission({mode: 'readwrite'}) === "granted") {
                resolve({handle: storedHandle, type: "local"})
                return
            }
        }

        if (!('showDirectoryPicker' in self)) {
            alert("Your browser doesn't support the File System Access API. Please use a modern browser like Chrome or Firefox. Supported browsers: https://caniuse.com/native-filesystem-api")
            return
        }
        const handle = await window.showDirectoryPicker({
            id: "changes",
            mode: "readwrite"
        })
        await idb_set('changes-handle', handle)
        resolve({handle, type: "local"});
    })
}).then(persistence => {
    console.log("Persistence:", persistence)
    document.body.classList.add('loading')
    document.getElementById('persistence')!.classList.add('hidden');
    document.getElementById('save-button')!.textContent = persistence.type === 'local' ? 'Save locally' : `Save online as ${persistence.user.displayName}`
    document.getElementById('sign-out-button')!.addEventListener('click', async () => {
        await Promise.allSettled([
            await idb_del('changes-handle'),
            await auth.signOut()
        ])
        window.location.reload()
    })
    return persistence;
})

setOptions({key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, v: "weekly"});

const {
    Map3DElement,
    Marker3DElement,
    Marker3DInteractiveElement
} = (await importLibrary('maps3d')) as google.maps.Maps3DLibrary & {
    Map3DElement: google.maps.maps3d.Map3DElement,
    Marker3DElement: google.maps.maps3d.Marker3DElement,
    Marker3DInteractiveElement: google.maps.maps3d.Marker3DInteractiveElement
};
const {PinElement} = await importLibrary('marker');
const {StreetViewService} = await importLibrary("streetView")
const {spherical} = await google.maps.importLibrary("geometry") as google.maps.GeometryLibrary;
const streetViewService = new StreetViewService()

export type TowerWithoutInfo = {
    lat: number,
    lng: number,
    index: number,
    database_date: string,
    database_line: number,
    tile_id: string,
    altitude: number,
}
export type Tower = TowerWithoutInfo & {
    nature: number,
}

const map = new Map3DElement({
    center: {lat: 48.6, lng: 2.3, altitude: 500},
    tilt: 67.5,
    heading: 0,
    // @ts-ignore
    mode: 'SATELLITE',
    gestureHandling: 'GREEDY',
});
document.body.append(map);

const heightMap = new Map3DElement({
    center: {lat: 48.6, lng: 2.3, altitude: 500},
    tilt: 90,
    heading: 0,
    // @ts-ignore
    mode: 'SATELLITE',
    gestureHandling: 'GREEDY',
})
document.body.append(heightMap);

const badPinElement = () => new PinElement({background: 'red', glyphColor: 'darkred', borderColor: 'darkred'})
const initialPinElement = () => new PinElement({
    background: '#FBBC04',
    glyphColor: 'darkorange',
    borderColor: 'darkorange'
})
const goodPinElement = () => new PinElement({background: 'lightgreen', glyphColor: 'green', borderColor: 'green'})
const otherTowerPinElement = () => new PinElement({background: 'lightblue', glyphColor: 'blue', borderColor: 'blue'})

export function createMarker(tower?: Tower | TowerWithoutInfo, label?: string, pinElement?: google.maps.marker.PinElement, mapElement = map) {
    const marker = new Marker3DElement({
        position: tower && {lat: tower.lat, lng: tower.lng, altitude: tower.altitude},
        altitudeMode: google.maps.maps3d.AltitudeMode.ABSOLUTE,
        extruded: true, // Draws line from ground to the bottom of the marker.
        label,
        drawsWhenOccluded: true,
    });
    if (pinElement) marker.append(pinElement);
    mapElement.append(marker);
    return marker
}

const streetViewManImg = document.createElement('img');
streetViewManImg.src = streetViewMan;
streetViewManImg.style.width = "50%";
const streetViewMarker = new Marker3DInteractiveElement({
    position: towers[0],
    drawsWhenOccluded: true,
});
streetViewMarker.addEventListener('gmp-click', (event) => {
    document.body.classList.toggle("street-view")
    event.stopPropagation();
});
const templateForImg = document.createElement('template');
templateForImg.content.append(streetViewManImg);
streetViewMarker.append(templateForImg);
map.append(streetViewMarker);

const markers = towers.map(tower => createMarker(tower, tower.index.toString(), initialPinElement()))

const streetViewButton = document.getElementById("street-view-toggle")! as HTMLLinkElement;
const streetView = document.getElementById("street-view")! as HTMLIFrameElement
streetViewButton.addEventListener("click", () => {
    if (streetViewButton.classList.contains("loading")) return;
    document.body.classList.toggle("street-view");
})

const heightMarkerOriginal = createMarker(undefined, undefined, initialPinElement(), heightMap)
const heightMarkerChanged = createMarker(undefined, undefined, goodPinElement(), heightMap)

async function setStreetView(index: number) {
    const response = await streetViewResponses[index]!;
    const panoLocation = response.data.location?.latLng;
    if (!panoLocation) {
        streetViewButton.classList.add("hidden")
        return;
    }

    const towerLocation = {
        lat: towers[index].lat,
        lng: towers[index].lng
    }

    streetViewMarker.position = panoLocation.toJSON();
    map.append(streetViewMarker)

    streetViewButton.classList.remove("hidden")

    const heading = spherical.computeHeading(panoLocation, towerLocation);

    const assumedTowerHeightAboveGround = 7; // A bit lower so we don't stare into the sky
    const assumedCameraHeightAboveGround = 2;
    const horizontalDistance = spherical.computeDistanceBetween(panoLocation, towerLocation);
    const heightDifference = assumedTowerHeightAboveGround - assumedCameraHeightAboveGround;

    // Math.atan2 returns radians, Google Maps URL expects degrees
    const pitch = Math.atan2(heightDifference, horizontalDistance) * (180 / Math.PI);

    const baseUrl = "https://www.google.com/maps/embed/v1/streetview";
    const params = new URLSearchParams({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        location: `${panoLocation.lat()},${panoLocation.lng()}`,
        heading: heading.toString(),
        pitch: pitch.toString(),
        fov: "90"
    });
    streetView.contentWindow?.location.replace(`${baseUrl}?${params.toString()}`)
}

function updateUI() {
    const change = changes[current]

    if (change) document.getElementById('reset-button')!.classList.remove('hidden');
    else document.getElementById('reset-button')!.classList.add('hidden');

    (document.getElementById('save-button')! as HTMLButtonElement).disabled = !dirty;

    (document.getElementById('bad-checkbox')! as HTMLInputElement).checked = change === false;

    markers[current].replaceChildren(change === false ? badPinElement() : initialPinElement())

    // Change text at top center
    let changeText = change === false ? "Bad tower" : ""
    if (change) changeText = `${change.lat.toFixed(5)}, ${change.lng.toFixed(5)}, ${change.altitude.toFixed(1)}m`
    document.getElementById("change-info")!.textContent = changeText;
    (document.getElementById("change-info")! as HTMLSpanElement).style.borderColor = change === false ? 'darkred' : (change === undefined ? '#333' : 'green');
    const nature = towers[current].nature in natures ? natures[towers[current].nature] : null;
    (document.getElementById("tower-info")! as HTMLSpanElement).textContent = `${current}/${towers.length}${nature ? ` (${nature.en}, ${towers[current].database_line})` : ""}`;
    (document.getElementById("tower-info")! as HTMLSpanElement).title = nature?.description ?? "";

    if (change) change.marker.position = changedPosition(current)!
    if (change) {
        heightMarkerChanged.position = changedPosition(current)!
        heightMap.append(heightMarkerChanged)
    } else if (heightMarkerChanged.parentElement) heightMap.removeChild(heightMarkerChanged)
    heightMap.center = changedPosition(current) ?? towers[current]
    heightMap.range = 50
    heightMap.tilt = 90

    if (streetView.dataset["index"] !== current.toString()) {
        if (streetViewResponses[current]) {
            streetView.dataset["index"] = current.toString();
            const oldCurrent = current
            streetViewButton.classList.add("loading")
            streetViewResponses[current]!.then(response => {
                if (oldCurrent !== current) return;
                streetViewButton.classList.remove("loading")
                setStreetView(current)
            }).catch(e => {
                streetViewButton.classList.add("hidden")
                return;
            })
        }
    }
}

type Change =
    { lat: number, lng: number, altitude: number, marker: google.maps.maps3d.Marker3DElement }
    | undefined
    | false;
export const changes: Change[] = Array(towers.length).fill(undefined)

function changedPosition(index: number) {
    const change = changes[index]
    if (!change) return null
    return {
        lat: towers[index].lat + change.lat,
        lng: towers[index].lng + change.lng,
        altitude: towers[index].altitude + change.altitude,
    }
}

let dirty = false

/// Lat and lng are absolute, altitude is relative to previous altitude
export function setChange(index: number, value: false | undefined | {
    lat?: number,
    lng?: number,
    deltaAltitude?: number
}, needsSaving: boolean = true) {
    if (needsSaving) dirty = true

    let change: Change;
    if (value === false || value === undefined) {
        change = value;
    } else {
        const {lat, lng, deltaAltitude} = value
        change = changes[index] && changes[index].marker ? changes[index] : {
            lat: 0,
            lng: 0,
            altitude: 0,
            marker: createMarker(towers[index], index + ' (changed)', goodPinElement()),
        }
        if (lat !== undefined) change.lat = lat
        if (lng !== undefined) change.lng = lng
        if (deltaAltitude !== undefined) change.altitude += deltaAltitude
    }

    changes[index] = change
    updateUI()
    if (needsSaving) save()
}

const parsed_changes_indices = await retrievePreviousChangesText(persistence, batch)

async function requestNearestStreetView(index: number) {
    if (streetViewResponses[index]) return streetViewResponses[index];

    const lat = towers[index].lat
    const lng = towers[index].lng

    const radius = 30;

    console.log("Requesting street view")
    streetViewResponses[index] = streetViewService.getPanorama({
        location: {lat, lng},
        radius,
        source: google.maps.StreetViewSource.OUTDOOR,
    })
    return streetViewResponses[index]
}

let otherTowerMarkers: google.maps.maps3d.Marker3DElement[] = []

async function loadOtherTowerMarkers() {
    for (const marker of otherTowerMarkers) marker.parentElement?.removeChild(marker)
    otherTowerMarkers = []

    const currentTower = towers[current];
    const radius = 100; // meters

    // Approximate bounding box filter for performance
    const dLat = radius / 111000;
    const dLng = radius / (111000 * Math.cos(currentTower.lat * Math.PI / 180));

    const nearbyTowers = allTowers.filter(other => {
        if (other.database_line === currentTower.database_line) return false;

        // Quick bounding box check
        if (Math.abs(other.lat - currentTower.lat) > dLat) return false;
        if (Math.abs(other.lng - currentTower.lng) > dLng) return false;

        // Accurate distance check
        const dist = spherical.computeDistanceBetween(
            {lat: currentTower.lat, lng: currentTower.lng},
            {lat: other.lat, lng: other.lng}
        );
        return dist <= radius;
    });

    otherTowerMarkers = nearbyTowers.map(otherTower =>
        createMarker(otherTower, "Other tower", otherTowerPinElement())
    );

    console.log("Loaded " + nearbyTowers.length + " nearby towers");
}

function jumpToTower(index: number, flyDuration = 1000) {
    current = index;
    document.body.classList.remove("street-view");
    if (streetViewMarker.parentElement) map.removeChild(streetViewMarker);
    streetView.src = "";
    if (!streetViewResponses[index]) {
        const _ = requestNearestStreetView(index)
    }
    const _ = loadOtherTowerMarkers()
    lookAtTower(index, true, flyDuration);
    updateUI();
}

function next(reference = current, flyDuration = 1000) {
    const next = (reference + 1) % towers.length
    if (next === 0) {
        const loadNextBatch = confirm("You reached the end. Do you want to load the next batch?")
        if (loadNextBatch) {
            url.searchParams.set("batch", (batch + 1).toString())
            window.location.href = url.toString();
            return
        }
    }
    jumpToTower(next, flyDuration)
}

function previous(reference = current) {
    jumpToTower((reference - 1 + towers.length) % towers.length)
}

function reset(flyDuration = 1000) {
    const change = changes[current]
    if (change && change.marker) map.removeChild(change.marker)
    setChange(current, undefined)
    lookAtTower(current, false, flyDuration)
}

function setBad(bad: boolean, flyDuration = 1000) {
    const change = changes[current]
    if (change && change.marker) map.removeChild(change.marker)
    setChange(current, bad ? false : undefined)
    if (!bad) lookAtTower(current, false, flyDuration)
    else setTimeout(() => next(), 100)
}

document.getElementById('next-button')!.addEventListener('click', _ => next());
document.getElementById('prev-button')!.addEventListener('click', _ => previous());
document.getElementById('reset-button')!.addEventListener('click', () => reset());
document.getElementById('bad-checkbox')!.addEventListener('change', (e) => setBad((e.target! as HTMLInputElement).checked))

async function toggleFullscreen() {
    if (!document.fullscreenElement) await document.body.requestFullscreen();
    else await document.exitFullscreen?.();
}

function topView() {
    map.stopCameraAnimation()
    map.flyCameraTo({
        endCamera: {
            center: changedPosition(current) ?? towers[current],
            range: 50,
            tilt: 0,
            heading: map.heading!,
        },
        durationMillis: 500,
    })
}

function setAsCorrectWithoutChanges() {
    setChange(current, {});
    next();
}

function toggleHeightViewer() {
    document.body.classList.toggle("height")
}

function toggleShortcutInfo() {
    document.body.classList.toggle("show-shortcuts")
}

document.getElementById('fullscreen-button')!.addEventListener('click', toggleFullscreen)
document.getElementById('correct-button')!.addEventListener('click', setAsCorrectWithoutChanges)
document.getElementById('top-view-button')!.addEventListener('click', topView)
document.getElementById('toggle-height-viewer')!.addEventListener('click', toggleHeightViewer)
document.getElementById('toggle-shortcut-info')!.addEventListener('click', toggleShortcutInfo)

document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case "Enter":
            setAsCorrectWithoutChanges()
            break;
        case 'ArrowRight':
            next()
            break;
        case 'ArrowLeft':
            previous()
            break;
        case 'ArrowDown':
            startMoving()
            setChange(current, {deltaAltitude: -1})
            e.stopPropagation()
            break;
        case 'ArrowUp':
            startMoving()
            setChange(current, {deltaAltitude: +1})
            e.stopPropagation()
            break;
        case "Backspace":
            setBad(changes[current] !== false)
            break;
        case ' ':
        case 'r':
            reset()
            break;
        case 'f':
            toggleFullscreen()
            break;
        case 's':
            document.body.classList.toggle("street-view")
            break;
        case 'h':
            toggleHeightViewer()
            break;
        case 't':
            topView();
            break;
        case 'i':
            toggleShortcutInfo()
            break;
    }
}, {passive: false, capture: true});

/*map.addEventListener('keydown', e => {
    e.stopPropagation()
    e.stopImmediatePropagation()
}, {passive: false})*/

let startedMoving = false

// Change tower position
map.addEventListener('gmp-centerchange', _ => {
    if (!startedMoving) return
    if (changes[current] === false) return
    setChange(current, {
        lat: map.center!.lat - towers[current].lat,
        lng: map.center!.lng - towers[current].lng,
    })
})

const lockHeightMapCameraToMapCamera = false;
if (lockHeightMapCameraToMapCamera) {
    map.addEventListener('gmp-headingchange', _ => {
        if (!startedMoving) return;
        heightMap.stopCameraAnimation()
        heightMap.flyCameraTo({
            endCamera: {
                center: heightMap.center!,
                range: 50,
                tilt: 90,
                heading: map.heading!,
            },
            durationMillis: 0,
        });
    })
}

// Change tower height
let shifting = false
// Mousepad has inertia when scrolling - when changing height (by scrolling) and then letting go of the shiftKey causes
// the client to continue scrolling normally (changing the angle on the height map or zooming out on the normal map)
// We avoid that by waiting until no more scroll events are sent for 100ms, then allowing to scroll again
let isCooldown = false;
let cooldownTimer: number | null = null;

function startCooldown() {
    if (cooldownTimer !== null) clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
        isCooldown = false;
    }, 100);
}

document.addEventListener('keydown', (e) => {
    if (e.shiftKey) {
        shifting = true
        isCooldown = true;
        startCooldown();
    }
})
document.addEventListener('keyup', (e) => {
    if (!e.shiftKey) {
        shifting = false
        isCooldown = true;
        startCooldown();
    }
})
const lockMapHeadingToHeightMapHeading = true
heightMap.addEventListener('wheel', e => {
    if (isCooldown) {
        e.preventDefault();
        e.stopPropagation();
        startCooldown(); // Reset timer: inertia is still happening
        return;
    }
    heightMap.stopCameraAnimation()
    e.stopPropagation()
    e.preventDefault()
    if (!shifting) {
        heightMap.center = changedPosition(current) ?? towers[current]
        heightMap.heading = heightMap.heading! + e.deltaY / 40 * 2
        if (lockMapHeadingToHeightMapHeading) {
            map.stopCameraAnimation()
            map.heading = heightMap.heading!
            map.center = heightMap.center!
        }
        heightMap.tilt = 90
        heightMap.range = 50
    } else {
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        setChange(current, {deltaAltitude: delta / 80})
        map.center = changedPosition(current) ?? towers[current]
    }
}, {passive: false, capture: true})
map.addEventListener('wheel', e => {
    if (isCooldown) {
        e.preventDefault();
        e.stopPropagation();
        startCooldown(); // Reset timer: inertia is still happening
        return;
    }
    startMoving()
    if (shifting) {
        e.stopPropagation()
        e.preventDefault()
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        setChange(current, {deltaAltitude: delta / 80})
        map.center = changedPosition(current) ?? towers[current]
    }
}, {passive: false, capture: true})

const initialTilt = 45

function mapLookAtTower(index: number, circle = true, flyDuration = 1000) {
    const tower = towers[index]
    const center = changedPosition(index) ?? tower
    const flyToCamera = {
        center,
        range: 100,
        tilt: initialTilt,
        heading: 0,
    };

    map.stopCameraAnimation(); // Stop previous animation, if any
    map.flyCameraTo({
        endCamera: flyToCamera,
        durationMillis: flyDuration,
    });

    if (circle) {
        map.addEventListener('gmp-animationend', () => {
            setTimeout(() => document.body.classList.remove('loading'), 500) // Wait some time to avoid flickering
            map.flyCameraAround({
                camera: flyToCamera,
                durationMillis: 20000,
                repeatCount: 5,
            });
        }, {once: true});
    }
}

function heightMapLookAtTower(index: number, flyDuration = 1000) {
    const tower = towers[index]
    const center = changedPosition(index) ?? tower
    const flyToCamera = {
        center,
        range: 50,
        tilt: 90,
        heading: 0,
    };

    heightMap.stopCameraAnimation();
    heightMap.flyCameraTo({
        endCamera: flyToCamera,
        durationMillis: flyDuration,
    })
    heightMap.addEventListener('gmp-animationend', () => {
        heightMap.flyCameraAround({
            camera: flyToCamera,
            durationMillis: 20000,
            repeatCount: 5,
        });
    }, {once: true});
    heightMarkerOriginal.position = tower
}

function lookAtTower(index: number, force = false, flyDuration = 1000) {
    if (force || startedMoving || map.tilt !== initialTilt) mapLookAtTower(index, true, flyDuration)
    if (force || startedMoving) heightMapLookAtTower(index, flyDuration)
    setStreetView(index)
    startedMoving = false
}

// https://stackoverflow.com/a/72207078/11485145
// NOTE: the any[] here is still type-safe: we're just
// constraining the generic to be a function type and the
// concrete type of T will be determined at the call site
function debounce<T extends (...args: any[]) => void>(
    wait: number,
    callback: T,
    immediate = false,
) {
    // This is a number in the browser and an object in Node.js,
    // so we'll use the ReturnType utility to cover both cases.
    let timeout: ReturnType<typeof setTimeout> | null;

    return function <U>(this: U, ...args: Parameters<typeof callback>) {
        const context = this;
        const later = () => {
            timeout = null;

            if (!immediate) {
                callback.apply(context, args);
            }
        };
        const callNow = immediate && !timeout;

        if (typeof timeout === "number") {
            clearTimeout(timeout);
        }

        timeout = setTimeout(later, wait);

        if (callNow) {
            callback.apply(context, args);
        }
    };
}

const save = debounce(persistence.type === "local" ? 300 : 1000, async () => {
    if (!dirty) return;
    const content = serializeChanges()
    await persistChanges(persistence, batch, content)

    dirty = false
    updateUI()
});

(document.getElementById('save-button')! as HTMLButtonElement).addEventListener('click', save);

setInterval(save, 10 * 1000)

function startMoving() {
    map.stopCameraAnimation();
    heightMap.stopCameraAnimation();
    startedMoving = true
}

map.addEventListener('mousedown', startMoving);
heightMap.addEventListener('mousedown', startMoving);

if (parsed_changes_indices.length > 0) {
    console.log("Jumping to first unchanged tower")
    next(parsed_changes_indices[parsed_changes_indices.length - 1], 1) // flyDuration = 1 because 0 doesn't trigger animationend event
} else jumpToTower(current, 1)

const focusStealer = document.createElement('input');
focusStealer.style.position = 'absolute';
focusStealer.style.opacity = '0';
focusStealer.style.pointerEvents = 'none';
focusStealer.tabIndex = -1;
focusStealer.width = 0
focusStealer.height = 0
focusStealer.style.bottom = "0"
focusStealer.style.left = "0"
document.body.appendChild(focusStealer);

window.addEventListener('blur', () => {
    setTimeout(() => {
        focusStealer.focus();
    }, 100);
});
