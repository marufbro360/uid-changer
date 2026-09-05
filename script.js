// ---------- ULEB128 UTILS ----------

// ULEB128 Decode (Bytes to BigInt)
function decode_leb128(bytes) {
    let result = 0n;
    let shift = 0n;
    for (let i = 0; i < bytes.length; i++) {
        const b = BigInt(bytes[i]);
        result |= (b & 0x7Fn) << shift;
        if ((b & 0x80n) === 0n) break;
        shift += 7n;
    }
    return result;
}

// ULEB128 Encode (BigInt to Bytes Array)
function encode_uleb128(value) {
    let val = (typeof value === "bigint") ? value : BigInt(value);
    const out = [];
    if (val === 0n) return [0x00];
    
    while (val > 0n) {
        let byte = Number(val & 0x7Fn);
        val >>= 7n;
        if (val !== 0n) {
            byte |= 0x80;
        }
        out.push(byte);
    }
    return out;
}

// Helper: Check if bytes are valid ULEB128
function isValidUleb128(bytes) {
    if (!bytes || bytes.length === 0) return false;
    
    // Check all bytes except the last one (Must have MSB set i.e., >= 0x80)
    for (let i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] < 0x80) return false;
    }
    
    // Check the last byte (Must have MSB clear i.e., < 0x80)
    if (bytes[bytes.length - 1] >= 0x80) return false;
    
    return true;
}

// ---------- PATTERN FINDERS (REVERSE SEARCH) ----------

// 1. Bytes File Logic: Find closest 38 ... 42 from the END
function findBytesPattern(data) {
    // Reverse loop: End se Start ki taraf
    for (let i = data.length - 1; i >= 0; i--) {
        // Agar End Marker (42) mila
        if (data[i] === 0x42) {
            // Ab iske piche closest Start Marker (38) dhundho
            // Hum max 10-12 bytes piche tak check karenge (UID bahut lamba nahi hota)
            for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
                if (data[j] === 0x38) {
                    // 38 aur 42 ke beech ka data nikalo
                    const candidate = data.slice(j + 1, i);
                    
                    // Check karo kya ye valid ULEB128 hai
                    if (isValidUleb128(candidate)) {
                        // Pattern Found!
                        return {
                            start: j,           // Position of 38
                            middleStart: j + 1, // Start of UID
                            end: i              // Position of 42
                        };
                    }
                    // Agar 38 mila par valid nahi tha, to hum is 42 ko skip nahi karenge,
                    // balki aur piche wala 38 dhundhenge? 
                    // Python logic ke hisab se closest 38 lena tha.
                    // Yahan hum break kar denge kyunki closest 38 fail ho gaya.
                    break; 
                }
            }
        }
    }
    return null; // Kuch nahi mila
}

// 2. Meta File Logic: Find closest 03 ... A2 03 from the END
function findMetaPattern(data) {
    // Reverse loop
    for (let i = data.length - 1; i >= 2; i--) {
        // Pattern match for End: ... A2 03
        if (data[i - 1] === 0xA2 && data[i] === 0x03) {
            // End marker mil gaya (position i-1 is A2). 
            // Ab piche closest 03 dhundho
            for (let j = i - 2; j >= Math.max(0, i - 14); j--) {
                if (data[j] === 0x03) {
                    // 03 (start) aur A2 (end start) ke beech ka data
                    const candidate = data.slice(j + 1, i - 1);
                    
                    if (isValidUleb128(candidate)) {
                        return {
                            start: j,           // Position of Start 03
                            middleStart: j + 1, // Start of UID
                            end: i - 1          // Position of A2
                        };
                    }
                    break; // Closest 03 fail hua to loop break
                }
            }
        }
    }
    return null;
}

// ---------- MAIN LOGIC & EVENTS ----------

let bytesData = { current: null, name: "", pattern: null };
let metaData = { current: null, name: "", pattern: null };

// --- BYTES FILE HANDLING ---
document.getElementById("bytesFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    const out = document.getElementById("bytesOutput");
    const ctr = document.getElementById("bytesControls");
    ctr.style.display = "none"; 
    ctr.innerHTML = "";
    
    if (!file) return;
    if (!file.name.endsWith(".bytes")) { 
        out.textContent = "Please select a .bytes file."; 
        return; 
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    bytesData = { current: buf, name: file.name, pattern: null };

    // New Reverse Logic Call
    const pat = findBytesPattern(buf);
    bytesData.pattern = pat;

    if (!pat) { 
        out.innerHTML = `File: <span class="highlight">${file.name}</span>\nStatus: UID Pattern (38..42) not found!`; 
        return; 
    }

    const uidBytes = Array.from(buf.slice(pat.middleStart, pat.end));
    const uidVal = decode_leb128(uidBytes);
    
    out.innerHTML = `File: <span class="highlight">${file.name}</span>\nFound UID: <span class="highlight">${uidVal.toString()}</span>`;
    
    // Show Controls
    ctr.style.display = "block";
    ctr.innerHTML = `
        <button class="btn" id="editBytes">Edit UID</button>
        <button class="btn secondary" id="removeBytes">Remove UID</button><br>
        <button class="btn" id="downloadBytes" style="margin-top:10px;">Download .bytes</button>`;
        
    document.getElementById("editBytes").onclick = () => editUID(bytesData, out, 'bytes');
    document.getElementById("removeBytes").onclick = () => removeUID(bytesData, out, 'bytes');
    document.getElementById("downloadBytes").onclick = () => downloadFile(bytesData);
});

// --- META FILE HANDLING ---
document.getElementById("metaFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    const out = document.getElementById("metaOutput");
    const ctr = document.getElementById("metaControls");
    ctr.style.display = "none"; 
    ctr.innerHTML = "";

    if (!file) return;
    if (!file.name.endsWith(".meta")) { 
        out.textContent = "Please select a .meta file."; 
        return; 
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    metaData = { current: buf, name: file.name, pattern: null };

    // New Reverse Logic Call
    const pat = findMetaPattern(buf);
    metaData.pattern = pat;

    if (!pat) { 
        out.innerHTML = `File: <span class="highlight">${file.name}</span>\nStatus: UID Pattern (03..A2 03) not found!`; 
        return; 
    }

    const uidBytes = Array.from(buf.slice(pat.middleStart, pat.end));
    const uidVal = decode_leb128(uidBytes);

    out.innerHTML = `File: <span class="highlight">${file.name}</span>\nFound UID: <span class="highlight">${uidVal.toString()}</span>`;
    
    ctr.style.display = "block";
    ctr.innerHTML = `
        <button class="btn" id="editMeta">Edit UID</button>
        <button class="btn secondary" id="removeMeta">Remove UID</button><br>
        <button class="btn" id="downloadMeta" style="margin-top:10px;">Download .meta</button>`;

    document.getElementById("editMeta").onclick = () => editUID(metaData, out, 'meta');
    document.getElementById("removeMeta").onclick = () => removeUID(metaData, out, 'meta');
    document.getElementById("downloadMeta").onclick = () => downloadFile(metaData);
});

// ---------- COMMON ACTIONS ----------

function editUID(data, output, type) {
    const pat = data.pattern; 
    if (!pat) return;

    const newValStr = prompt("Enter new UID (Number):");
    if (newValStr === null) return;
    if (!/^\d+$/.test(newValStr)) { 
        alert("Invalid number! Only digits allowed."); 
        return; 
    }

    const newVal = BigInt(newValStr);
    const enc = encode_uleb128(newVal);

    // Reconstruct File
    const before = data.current.slice(0, pat.middleStart);
    const after = data.current.slice(pat.end);
    
    const outBytes = new Uint8Array(before.length + enc.length + after.length);
    outBytes.set(before, 0);
    outBytes.set(enc, before.length);
    outBytes.set(after, before.length + enc.length);

    data.current = outBytes;

    // Re-scan to find new offsets (zaroori hai agar file size change hua ho)
    if (type === 'bytes') data.pattern = findBytesPattern(outBytes);
    else data.pattern = findMetaPattern(outBytes);

    output.innerHTML = `File: <span class="highlight">${data.name}</span>\nNew UID: <span class="highlight">${newVal.toString()}</span>`;
    alert("UID updated successfully!");
}

function removeUID(data, output, type) {
    const pat = data.pattern; 
    if (!pat) return;

    // UID ko 0 kar dete hain (ULEB128 mein 0 ek byte 0x00 hota hai)
    const zeroByte = new Uint8Array([0x00]);
    
    const before = data.current.slice(0, pat.middleStart);
    const after = data.current.slice(pat.end);

    const outBytes = new Uint8Array(before.length + zeroByte.length + after.length);
    outBytes.set(before, 0);
    outBytes.set(zeroByte, before.length);
    outBytes.set(after, before.length + zeroByte.length);

    data.current = outBytes;

    if (type === 'bytes') data.pattern = findBytesPattern(outBytes);
    else data.pattern = findMetaPattern(outBytes);

    output.innerHTML = `File: <span class="highlight">${data.name}</span>\nUID Removed (Set to 0)`;
    alert("UID removed!");
}

function downloadFile(data) {
    const blob = new Blob([data.current], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    // Original name ke aage 'EDITED_' laga diya
    a.download = `EDITED_${data.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
