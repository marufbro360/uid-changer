// ============================================================
// CRAFTER MARUF — CRAFTLAND UID EDITOR
// ============================================================


// ============================================================
// ULEB128
// ============================================================

function decode_leb128(bytes) {

    let result = 0n;
    let shift = 0n;

    for (let i = 0; i < bytes.length; i++) {

        const b = BigInt(bytes[i]);

        result |=
            (b & 0x7Fn) << shift;

        if ((b & 0x80n) === 0n) {
            break;
        }

        shift += 7n;
    }

    return result;
}


function encode_uleb128(value) {

    let val =
        typeof value === "bigint"
            ? value
            : BigInt(value);

    const out = [];

    if (val === 0n) {
        return [0x00];
    }

    while (val > 0n) {

        let byte =
            Number(val & 0x7Fn);

        val >>= 7n;

        if (val !== 0n) {
            byte |= 0x80;
        }

        out.push(byte);
    }

    return out;
}


function isValidUleb128(bytes) {

    if (!bytes || bytes.length === 0) {
        return false;
    }

    for (
        let i = 0;
        i < bytes.length - 1;
        i++
    ) {

        if (bytes[i] < 0x80) {
            return false;
        }
    }

    if (
        bytes[bytes.length - 1] >= 0x80
    ) {
        return false;
    }

    return true;
}


// ============================================================
// BYTES PATTERN
// ============================================================

function findBytesPattern(data) {

    for (
        let i = data.length - 1;
        i >= 0;
        i--
    ) {

        if (data[i] === 0x42) {

            for (
                let j = i - 1;
                j >= Math.max(0, i - 12);
                j--
            ) {

                if (data[j] === 0x38) {

                    const candidate =
                        data.slice(j + 1, i);

                    if (
                        isValidUleb128(candidate)
                    ) {

                        return {

                            start: j,

                            middleStart: j + 1,

                            end: i

                        };
                    }

                    break;
                }
            }
        }
    }

    return null;
}


// ============================================================
// META PATTERN
// ============================================================

function findMetaPattern(data) {

    for (
        let i = data.length - 1;
        i >= 2;
        i--
    ) {

        if (
            data[i - 1] === 0xA2 &&
            data[i] === 0x03
        ) {

            for (
                let j = i - 2;
                j >= Math.max(0, i - 14);
                j--
            ) {

                if (data[j] === 0x03) {

                    const candidate =
                        data.slice(
                            j + 1,
                            i - 1
                        );

                    if (
                        isValidUleb128(candidate)
                    ) {

                        return {

                            start: j,

                            middleStart: j + 1,

                            end: i - 1

                        };
                    }

                    break;
                }
            }
        }
    }

    return null;
}


// ============================================================
// DATA
// ============================================================

let bytesData = {

    current: null,

    name: "",

    pattern: null
};


let metaData = {

    current: null,

    name: "",

    pattern: null
};


// ============================================================
// DOM
// ============================================================

const bytesFile =
    document.getElementById("bytesFile");

const metaFile =
    document.getElementById("metaFile");

const bytesOutput =
    document.getElementById("bytesOutput");

const metaOutput =
    document.getElementById("metaOutput");

const bytesControls =
    document.getElementById("bytesControls");

const metaControls =
    document.getElementById("metaControls");

const bytesDropZone =
    document.getElementById("bytesDropZone");

const metaDropZone =
    document.getElementById("metaDropZone");


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = "success"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.textContent =
        message;

    container.appendChild(toast);


    setTimeout(() => {

        toast.style.opacity = "0";

        toast.style.transform =
            "translateX(20px)";

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 2500);
}


// ============================================================
// FILE SIZE
// ============================================================

function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }

    const sizes = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    return (
        parseFloat(
            (
                bytes /
                Math.pow(1024, i)
            ).toFixed(2)
        )
        +
        " " +
        sizes[i]
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// PROCESS FILE
// ============================================================

async function processFile(
    file,
    type
) {

    const output =
        type === "bytes"
            ? bytesOutput
            : metaOutput;

    const controls =
        type === "bytes"
            ? bytesControls
            : metaControls;


    const info =
        document.getElementById(
            `${type}FileInfo`
        );


    const nameElement =
        document.getElementById(
            `${type}FileName`
        );


    const sizeElement =
        document.getElementById(
            `${type}FileSize`
        );


    controls.style.display =
        "none";

    controls.innerHTML =
        "";


    if (!file) {
        return;
    }


    const extension =
        type === "bytes"
            ? ".bytes"
            : ".meta";


    if (
        !file.name
            .toLowerCase()
            .endsWith(extension)
    ) {

        output.innerHTML =

            `<span class="highlight">ERROR</span>\n` +

            `Please select a ${extension} file.`;


        showToast(
            `Invalid file! Please select ${extension}`,
            "error"
        );

        return;
    }


    info.style.display =
        "flex";


    nameElement.textContent =
        file.name;


    sizeElement.textContent =
        formatFileSize(file.size);


    output.innerHTML = `

        <span class="processing">

            PROCESSING

            <span></span>
            <span></span>
            <span></span>

        </span>

    `;


    try {

        const buffer =
            new Uint8Array(
                await file.arrayBuffer()
            );


        if (type === "bytes") {

            bytesData = {

                current: buffer,

                name: file.name,

                pattern:
                    findBytesPattern(buffer)

            };


            handlePatternResult(

                bytesData,

                bytesOutput,

                bytesControls,

                "bytes"

            );

        } else {

            metaData = {

                current: buffer,

                name: file.name,

                pattern:
                    findMetaPattern(buffer)

            };


            handlePatternResult(

                metaData,

                metaOutput,

                metaControls,

                "meta"

            );
        }

    } catch (error) {

        output.innerHTML =

            `<span class="highlight">ERROR</span>\n` +

            `Unable to read file.`;


        showToast(
            "Unable to read file!",
            "error"
        );


        console.error(error);
    }
}


// ============================================================
// RESULT
// ============================================================

function handlePatternResult(
    data,
    output,
    controls,
    type
) {

    if (!data.pattern) {

        const patternText =

            type === "bytes"

                ? "UID Pattern (38..42) not found!"

                : "UID Pattern (03..A2 03) not found!";


        output.innerHTML =

            `<span class="highlight">` +

            `${escapeHTML(data.name)}` +

            `</span>\n` +

            `<span style="color:#ff5370">` +

            `${patternText}` +

            `</span>`;


        showToast(
            "UID pattern not found!",
            "error"
        );

        return;
    }


    const uidBytes =
        Array.from(

            data.current.slice(

                data.pattern.middleStart,

                data.pattern.end

            )

        );


    const uidVal =
        decode_leb128(uidBytes);


    output.innerHTML =

        `File: ` +

        `<span class="highlight">` +

        `${escapeHTML(data.name)}` +

        `</span>\n` +

        `Found UID: ` +

        `<span class="highlight">` +

        `${uidVal.toString()}` +

        `</span>`;


    buildControls(

        data,

        output,

        controls,

        type

    );


    showToast(
        `${type.toUpperCase()} file loaded successfully`
    );
}


// ============================================================
// CONTROLS
// ============================================================

function buildControls(
    data,
    output,
    controls,
    type
) {

    controls.style.display =
        "flex";


    const editId =

        type === "bytes"

            ? "editBytes"

            : "editMeta";


    const removeId =

        type === "bytes"

            ? "removeBytes"

            : "removeMeta";


    const downloadId =

        type === "bytes"

            ? "downloadBytes"

            : "downloadMeta";


    controls.innerHTML = `

        <button
            class="btn"
            id="${editId}"
        >
            EDIT UID
        </button>


        <button
            class="btn secondary"
            id="${removeId}"
        >
            REMOVE UID
        </button>


        <button
            class="btn download"
            id="${downloadId}"
        >
            DOWNLOAD .${type}
        </button>

    `;


    document
        .getElementById(editId)
        .onclick = () => {

            editUID(
                data,
                output,
                type
            );

        };


    document
        .getElementById(removeId)
        .onclick = () => {

            removeUID(
                data,
                output,
                type
            );

        };


    document
        .getElementById(downloadId)
        .onclick = () => {

            downloadFile(data);

        };
}


// ============================================================
// MODAL
// ============================================================

let modalCallback = null;


function openUIDModal(callback) {

    const modal =
        document.getElementById(
            "uidModal"
        );


    const input =
        document.getElementById(
            "newUidInput"
        );


    const error =
        document.getElementById(
            "modalError"
        );


    modalCallback =
        callback;


    input.value =
        "";


    error.textContent =
        "";


    modal.classList.add(
        "active"
    );


    setTimeout(() => {

        input.focus();

    }, 100);
}


function closeUIDModal() {

    const modal =
        document.getElementById(
            "uidModal"
        );


    modal.classList.remove(
        "active"
    );


    modalCallback =
        null;
}


// Close

document
    .getElementById("modalClose")
    .onclick =
    closeUIDModal;


document
    .getElementById("modalCancel")
    .onclick =
    closeUIDModal;


// Outside click

document
    .getElementById("uidModal")
    .addEventListener(
        "click",
        function(e) {

            if (e.target === this) {

                closeUIDModal();

            }

        }
    );


// Confirm

document
    .getElementById("modalConfirm")
    .onclick =
    function() {

        const input =
            document.getElementById(
                "newUidInput"
            );


        const error =
            document.getElementById(
                "modalError"
            );


        const value =
            input.value.trim();


        if (!/^\d+$/.test(value)) {

            error.textContent =
                "Only numbers are allowed.";

            input.focus();

            return;
        }


        if (value.length > 30) {

            error.textContent =
                "UID is too long.";

            input.focus();

            return;
        }


        if (modalCallback) {

            modalCallback(value);

        }


        closeUIDModal();

    };


// Keyboard

document
    .getElementById("newUidInput")
    .addEventListener(
        "keydown",
        function(e) {

            if (e.key === "Enter") {

                document
                    .getElementById(
                        "modalConfirm"
                    )
                    .click();

            }


            if (e.key === "Escape") {

                closeUIDModal();

            }

        }
    );


// ============================================================
// EDIT UID
// ============================================================

function editUID(
    data,
    output,
    type
) {

    const pat =
        data.pattern;


    if (!pat) {
        return;
    }


    openUIDModal(
        function(newValStr) {

            try {

                const newVal =
                    BigInt(newValStr);


                const enc =
                    encode_uleb128(
                        newVal
                    );


                const before =
                    data.current.slice(
                        0,
                        pat.middleStart
                    );


                const after =
                    data.current.slice(
                        pat.end
                    );


                const outBytes =
                    new Uint8Array(

                        before.length +

                        enc.length +

                        after.length

                    );


                outBytes.set(
                    before,
                    0
                );


                outBytes.set(
                    enc,
                    before.length
                );


                outBytes.set(
                    after,
                    before.length +
                    enc.length
                );


                data.current =
                    outBytes;


                if (type === "bytes") {

                    data.pattern =
                        findBytesPattern(
                            outBytes
                        );

                } else {

                    data.pattern =
                        findMetaPattern(
                            outBytes
                        );

                }


                output.innerHTML =

                    `File: ` +

                    `<span class="highlight">` +

                    `${escapeHTML(data.name)}` +

                    `</span>\n` +

                    `New UID: ` +

                    `<span class="highlight">` +

                    `${newVal.toString()}` +

                    `</span>`;


                showToast(
                    "UID updated successfully!"
                );


            } catch (error) {

                showToast(
                    "Failed to update UID!",
                    "error"
                );


                console.error(error);
            }

        }
    );
}


// ============================================================
// REMOVE UID
// ============================================================

function removeUID(
    data,
    output,
    type
) {

    const pat =
        data.pattern;


    if (!pat) {
        return;
    }


    const zeroByte =
        new Uint8Array([
            0x00
        ]);


    const before =
        data.current.slice(
            0,
            pat.middleStart
        );


    const after =
        data.current.slice(
            pat.end
        );


    const outBytes =
        new Uint8Array(

            before.length +

            zeroByte.length +

            after.length

        );


    outBytes.set(
        before,
        0
    );


    outBytes.set(
        zeroByte,
        before.length
    );


    outBytes.set(
        after,
        before.length +
        zeroByte.length
    );


    data.current =
        outBytes;


    if (type === "bytes") {

        data.pattern =
            findBytesPattern(
                outBytes
            );

    } else {

        data.pattern =
            findMetaPattern(
                outBytes
            );

    }


    output.innerHTML =

        `File: ` +

        `<span class="highlight">` +

        `${escapeHTML(data.name)}` +

        `</span>\n` +

        `UID Removed (Set to 0)`;


    showToast(
        "UID removed successfully!"
    );
}


// ============================================================
// DOWNLOAD
// ============================================================

function downloadFile(data) {

    if (!data.current) {

        showToast(
            "No file available!",
            "error"
        );

        return;
    }


    const blob =
        new Blob(
            [data.current],
            {
                type:
                    "application/octet-stream"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const a =
        document.createElement("a");


    a.href =
        url;


    a.download =
        `EDITED_${data.name}`;


    document
        .body
        .appendChild(a);


    a.click();


    document
        .body
        .removeChild(a);


    setTimeout(() => {

        URL.revokeObjectURL(url);

    }, 2000);


    showToast(
        `Downloaded: EDITED_${data.name}`
    );
}


// ============================================================
// FILE INPUT
// ============================================================

bytesFile.addEventListener(
    "change",
    function(e) {

        processFile(
            e.target.files[0],
            "bytes"
        );

    }
);


metaFile.addEventListener(
    "change",
    function(e) {

        processFile(
            e.target.files[0],
            "meta"
        );

    }
);


// ============================================================
// UPLOAD ZONE CLICK
// ============================================================

bytesDropZone.addEventListener(
    "click",
    function(e) {

        if (e.target !== bytesFile) {

            bytesFile.click();

        }

    }
);


metaDropZone.addEventListener(
    "click",
    function(e) {

        if (e.target !== metaFile) {

            metaFile.click();

        }

    }
);


// ============================================================
// DRAG & DROP
// ============================================================

function setupDropZone(
    zone,
    input,
    type
) {

    [
        "dragenter",
        "dragover"

    ].forEach(
        eventName => {

            zone.addEventListener(
                eventName,
                function(e) {

                    e.preventDefault();

                    e.stopPropagation();

                    zone.classList.add(
                        "dragover"
                    );

                }
            );

        }
    );


    [
        "dragleave",
        "drop"

    ].forEach(
        eventName => {

            zone.addEventListener(
                eventName,
                function(e) {

                    e.preventDefault();

                    e.stopPropagation();

                    zone.classList.remove(
                        "dragover"
                    );

                }
            );

        }
    );


    zone.addEventListener(
        "drop",
        function(e) {

            const files =
                e.dataTransfer.files;


            if (!files.length) {
                return;
            }


            const file =
                files[0];


            processFile(
                file,
                type
            );

        }
    );
}


setupDropZone(
    bytesDropZone,
    bytesFile,
    "bytes"
);


setupDropZone(
    metaDropZone,
    metaFile,
    "meta"
);


// ============================================================
// GLOBAL DRAG PREVENT
// ============================================================

document.addEventListener(
    "dragover",
    function(e) {

        e.preventDefault();

    }
);


document.addEventListener(
    "drop",
    function(e) {

        e.preventDefault();

    }
);                "UID REMOVED",
                `
                    File:
                    <span class="highlight">
                        ${escapeHTML(data.name)}
                    </span>
                    <br>
                    UID has been set to:
                    <span class="highlight">
                        0
                    </span>
                `
            );


            showToast(
                "UID removed successfully!"
            );


        } catch (error) {

            console.error(error);

            setResult(
                output,
                "error",
                "REMOVE ERROR",
                "Unable to remove UID."
            );

            showToast(
                "UID removal failed.",
                "error"
            );
        }

    }, 350);
}


/* =========================================================
   DOWNLOAD
   ========================================================= */

function downloadFile(data) {

    if (
        !data ||
        !data.current
    ) {

        showToast(
            "No edited file is available.",
            "error"
        );

        return;
    }


    try {

        const blob =
            new Blob(
                [data.current],
                {
                    type:
                        "application/octet-stream"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                "a"
            );


        a.href = url;


        a.download =
            `EDITED_${data.name}`;


        document.body.appendChild(
            a
        );


        a.click();


        document.body.removeChild(
            a
        );


        setTimeout(() => {

            URL.revokeObjectURL(
                url
            );

        }, 2000);


        showToast(
            `Download started: EDITED_${data.name}`
        );


    } catch (error) {

        console.error(error);

        showToast(
            "Download failed.",
            "error"
        );
    }
}


/* =========================================================
   DRAG & DROP
   ========================================================= */

function setupDropZone(
    zone,
    input,
    type
) {

    if (!zone || !input) {
        return;
    }


    zone.addEventListener(
        "click",
        function (e) {

            /*
             * Avoid double triggering
             * when clicking the input itself.
             */

            if (
                e.target === input
            ) {
                return;
            }

            input.click();
        }
    );


    [
        "dragenter",
        "dragover"
    ].forEach(eventName => {

        zone.addEventListener(
            eventName,
            function (e) {

                e.preventDefault();

                e.stopPropagation();

                zone.classList.add(
                    "dragover"
                );
            }
        );
    });


    [
        "dragleave",
        "drop"
    ].forEach(eventName => {

        zone.addEventListener(
            eventName,
            function (e) {

                e.preventDefault();

                e.stopPropagation();

                zone.classList.remove(
                    "dragover"
                );
            }
        );
    });


    zone.addEventListener(
        "drop",
        async function (e) {

            const file =
                e.dataTransfer.files[0];

            if (!file) {
                return;
            }


            /*
             * Put dropped file into
             * the file input too.
             */

            try {

                const dt =
                    new DataTransfer();

                dt.items.add(file);

                input.files =
                    dt.files;

            } catch (error) {

                console.log(
                    "DataTransfer unavailable."
                );
            }


            await processFile(
                file,
                type
            );
        }
    );
}


setupDropZone(
    bytesDropZone,
    bytesFile,
    "bytes"
);


setupDropZone(
    metaDropZone,
    metaFile,
    "meta"
);


/* =========================================================
   DRAG & DROP DOCUMENT PREVENTION
   ========================================================= */

[
    "dragenter",
    "dragover",
    "dragleave",
    "drop"
].forEach(eventName => {

    document.addEventListener(
        eventName,
        function (e) {

            e.preventDefault();

        },
        false
    );
});


/* =========================================================
   UTILITY DELAY
   ========================================================= */

function delay(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* =========================================================
   PAGE LOAD ANIMATION
   ========================================================= */

window.addEventListener(
    "load",
    function () {

        document.body.classList.add(
            "page-loaded"
        );

    }
);