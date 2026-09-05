/* =========================================================
   CRAFTLAND UID EDITOR
   PREMIUM EDITION

   CORE UID LOGIC PRESERVED
   - ULEB128 Decode
   - ULEB128 Encode
   - BYTES 38...42 Pattern
   - META 03...A2 03 Pattern
   - Edit UID
   - Remove UID
   - Download
   ========================================================= */


/* =========================================================
   ULEB128 UTILS
   ========================================================= */


/**
 * ULEB128 Decode
 * Bytes -> BigInt
 */
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


/**
 * ULEB128 Encode
 * BigInt -> Bytes Array
 */
function encode_uleb128(value) {

    let val =
        (typeof value === "bigint")
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


/**
 * Check valid ULEB128
 */
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


/* =========================================================
   PATTERN FINDERS
   ========================================================= */


/**
 * BYTES:
 *
 * Find closest:
 *
 * 38 ... 42
 *
 * from END
 */
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

                            middleStart:
                                j + 1,

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


/**
 * META:
 *
 * Find closest:
 *
 * 03 ... A2 03
 *
 * from END
 */
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
                        data.slice(j + 1, i - 1);

                    if (
                        isValidUleb128(candidate)
                    ) {

                        return {

                            start: j,

                            middleStart:
                                j + 1,

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


/* =========================================================
   GLOBAL DATA
   ========================================================= */

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


/* =========================================================
   DOM
   ========================================================= */

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


/* =========================================================
   HELPERS
   ========================================================= */


/**
 * Format file size
 */
function formatFileSize(bytes) {

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {

        return (
            `${(bytes / 1024).toFixed(2)} KB`
        );
    }

    return (
        `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    );
}


/**
 * Escape HTML
 */
function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/**
 * Toast
 */
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
        `toast ${type === "error" ? "error" : ""}`;

    toast.innerHTML = `

        <div class="toast-icon">
            ${type === "error" ? "!" : "✓"}
        </div>

        <div class="toast-text">
            ${escapeHTML(message)}
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {

        toast.classList.add("out");

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 2800);
}


/**
 * Set result state
 */
function setResult(
    output,
    type,
    title,
    message
) {

    output.className =
        `result-box ${type || ""}`;

    let icon = "◌";

    if (type === "success") {
        icon = "✓";
    }

    if (type === "error") {
        icon = "!";
    }

    if (type === "processing") {
        icon = "◌";
    }

    output.innerHTML = `

        <div class="result-icon">
            ${icon}
        </div>

        <div>

            <span class="result-label">
                ${escapeHTML(title)}
            </span>

            <strong>
                ${message}
            </strong>

        </div>
    `;
}


/**
 * Show processing state
 */
function showProcessing(
    output,
    message
) {

    output.className =
        "result-box processing";

    output.innerHTML = `

        <div class="result-icon">
            ◌
        </div>

        <div>

            <span class="result-label">
                PROCESSING
            </span>

            <strong>
                ${escapeHTML(message)}
            </strong>

        </div>
    `;
}


/**
 * File info update
 */
function updateFileInfo(
    type,
    file
) {

    const prefix =
        type === "bytes"
            ? "bytes"
            : "meta";

    const info =
        document.getElementById(
            `${prefix}FileInfo`
        );

    const name =
        document.getElementById(
            `${prefix}FileName`
        );

    const size =
        document.getElementById(
            `${prefix}FileSize`
        );

    if (!file) {

        info.classList.remove("active");

        name.textContent =
            "No file selected";

        size.textContent =
            "Waiting for file...";

        return;
    }

    info.classList.add("active");

    name.textContent =
        file.name;

    size.textContent =
        `${formatFileSize(file.size)} • ${type.toUpperCase()} FILE`;
}


/* =========================================================
   BYTES FILE
   ========================================================= */

bytesFile.addEventListener(
    "change",
    async function (e) {

        const file =
            e.target.files[0];

        await processFile(
            file,
            "bytes"
        );
    }
);


/* =========================================================
   META FILE
   ========================================================= */

metaFile.addEventListener(
    "change",
    async function (e) {

        const file =
            e.target.files[0];

        await processFile(
            file,
            "meta"
        );
    }
);


/* =========================================================
   FILE PROCESSOR
   ========================================================= */

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

    const expectedExtension =
        type === "bytes"
            ? ".bytes"
            : ".meta";

    controls.innerHTML = "";

    updateFileInfo(
        type,
        null
    );

    if (!file) {
        return;
    }


    /* Extension Check */

    if (
        !file.name
            .toLowerCase()
            .endsWith(expectedExtension)
    ) {

        setResult(
            output,
            "error",
            "INVALID FILE",
            `Please select a ${expectedExtension} file.`
        );

        showToast(
            `Invalid file. Please select ${expectedExtension}`,
            "error"
        );

        return;
    }


    updateFileInfo(
        type,
        file
    );


    /* Processing animation */

    showProcessing(
        output,
        "Reading file..."
    );


    /*
     * Small delay makes the premium
     * processing animation visible
     */
    await delay(250);


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
                output,
                controls,
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
                output,
                controls,
                "meta"
            );
        }

    } catch (error) {

        console.error(error);

        setResult(
            output,
            "error",
            "READ ERROR",
            "Unable to read this file."
        );

        showToast(
            "Could not read the selected file.",
            "error"
        );
    }
}


/* =========================================================
   PATTERN RESULT
   ========================================================= */

function handlePatternResult(
    data,
    output,
    controls,
    type
) {

    const pattern =
        data.pattern;


    if (!pattern) {

        setResult(
            output,
            "error",
            "PATTERN NOT FOUND",
            type === "bytes"
                ? "UID Pattern (38..42) not found."
                : "UID Pattern (03..A2 03) not found."
        );

        showToast(
            "UID pattern was not found in this file.",
            "error"
        );

        return;
    }


    const uidBytes =
        Array.from(
            data.current.slice(
                pattern.middleStart,
                pattern.end
            )
        );


    let uidVal;

    try {

        uidVal =
            decode_leb128(uidBytes);

    } catch (error) {

        setResult(
            output,
            "error",
            "UID ERROR",
            "Could not decode UID."
        );

        return;
    }


    setResult(
        output,
        "success",
        "UID FOUND",
        `
            File:
            <span class="highlight">
                ${escapeHTML(data.name)}
            </span>
            <br>
            UID:
            <span class="highlight">
                ${uidVal.toString()}
            </span>
        `
    );


    buildControls(
        controls,
        data,
        output,
        type
    );


    showToast(
        `UID detected: ${uidVal.toString()}`
    );
}


/* =========================================================
   BUILD BUTTONS
   ========================================================= */

function buildControls(
    controls,
    data,
    output,
    type
) {

    const prefix =
        type === "bytes"
            ? "Bytes"
            : "Meta";


    controls.innerHTML = `

        <button
            class="btn"
            id="edit${prefix}"
            type="button"
        >
            ✎ &nbsp; EDIT UID
        </button>

        <button
            class="btn secondary"
            id="remove${prefix}"
            type="button"
        >
            ◇ &nbsp; REMOVE UID
        </button>

        <button
            class="btn download-btn"
            id="download${prefix}"
            type="button"
        >
            ↓ &nbsp; DOWNLOAD EDITED .${type.toUpperCase()}
        </button>
    `;


    document
        .getElementById(
            `edit${prefix}`
        )
        .onclick = () => {

            openUidModal(
                data,
                output,
                type
            );
        };


    document
        .getElementById(
            `remove${prefix}`
        )
        .onclick = () => {

            confirmRemoveUID(
                data,
                output,
                type
            );
        };


    document
        .getElementById(
            `download${prefix}`
        )
        .onclick = () => {

            downloadFile(data);
        };
}


/* =========================================================
   PREMIUM UID MODAL
   ========================================================= */

const uidModal =
    document.getElementById(
        "uidModal"
    );

const newUidInput =
    document.getElementById(
        "newUidInput"
    );

const modalError =
    document.getElementById(
        "modalError"
    );

const modalClose =
    document.getElementById(
        "modalClose"
    );

const modalCancel =
    document.getElementById(
        "modalCancel"
    );

const modalConfirm =
    document.getElementById(
        "modalConfirm"
    );


let modalData = null;


/**
 * Open UID editor
 */
function openUidModal(
    data,
    output,
    type
) {

    modalData = {

        data,

        output,

        type
    };


    newUidInput.value = "";

    modalError.textContent = "";

    uidModal.classList.add(
        "active"
    );


    setTimeout(() => {

        newUidInput.focus();

    }, 250);
}


/**
 * Close modal
 */
function closeUidModal() {

    uidModal.classList.remove(
        "active"
    );

    modalData = null;
}


modalClose.onclick =
    closeUidModal;

modalCancel.onclick =
    closeUidModal;


/* Click outside */

uidModal.addEventListener(
    "click",
    function (e) {

        if (
            e.target === uidModal
        ) {

            closeUidModal();
        }
    }
);


/* ESC */

document.addEventListener(
    "keydown",
    function (e) {

        if (
            e.key === "Escape" &&
            uidModal.classList.contains(
                "active"
            )
        ) {

            closeUidModal();
        }
    }
);


/* Enter */

newUidInput.addEventListener(
    "keydown",
    function (e) {

        if (e.key === "Enter") {

            e.preventDefault();

            modalConfirm.click();
        }
    }
);


/* Only digits */

newUidInput.addEventListener(
    "input",
    function () {

        this.value =
            this.value.replace(
                /\D/g,
                ""
            );

        modalError.textContent = "";
    }
);


/* Confirm */

modalConfirm.onclick =
    function () {

        if (!modalData) {
            return;
        }


        const newValStr =
            newUidInput.value.trim();


        if (!newValStr) {

            modalError.textContent =
                "Please enter a UID.";

            newUidInput.focus();

            return;
        }


        if (!/^\d+$/.test(newValStr)) {

            modalError.textContent =
                "Only numbers are allowed.";

            return;
        }


        try {

            const newVal =
                BigInt(newValStr);

            editUID(
                modalData.data,
                modalData.output,
                modalData.type,
                newVal
            );

            closeUidModal();

        } catch (error) {

            console.error(error);

            modalError.textContent =
                "Invalid UID value.";
        }
    };


/* =========================================================
   EDIT UID
   ========================================================= */

function editUID(
    data,
    output,
    type,
    newVal
) {

    const pattern =
        data.pattern;


    if (!pattern) {
        return;
    }


    showProcessing(
        output,
        "Updating UID..."
    );


    setTimeout(() => {

        try {

            const encoded =
                encode_uleb128(
                    newVal
                );


            const before =
                data.current.slice(
                    0,
                    pattern.middleStart
                );


            const after =
                data.current.slice(
                    pattern.end
                );


            const outBytes =
                new Uint8Array(
                    before.length +
                    encoded.length +
                    after.length
                );


            outBytes.set(
                before,
                0
            );


            outBytes.set(
                encoded,
                before.length
            );


            outBytes.set(
                after,
                before.length +
                encoded.length
            );


            data.current =
                outBytes;


            /*
             * Re-scan.
             *
             * Important because the new
             * UID can have a different size.
             */

            if (
                type === "bytes"
            ) {

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


            setResult(
                output,
                "success",
                "UID UPDATED",
                `
                    File:
                    <span class="highlight">
                        ${escapeHTML(data.name)}
                    </span>
                    <br>
                    New UID:
                    <span class="highlight">
                        ${newVal.toString()}
                    </span>
                `
            );


            showToast(
                "UID updated successfully!"
            );


        } catch (error) {

            console.error(error);

            setResult(
                output,
                "error",
                "UPDATE ERROR",
                "Unable to update UID."
            );

            showToast(
                "UID update failed.",
                "error"
            );

        }

    }, 350);
}


/* =========================================================
   REMOVE UID
   ========================================================= */

function confirmRemoveUID(
    data,
    output,
    type
) {

    const confirmed =
        window.confirm(
            "Remove UID?\n\nThe UID will be replaced with 0."
        );


    if (!confirmed) {
        return;
    }


    removeUID(
        data,
        output,
        type
    );
}


function removeUID(
    data,
    output,
    type
) {

    const pattern =
        data.pattern;


    if (!pattern) {
        return;
    }


    showProcessing(
        output,
        "Removing UID..."
    );


    setTimeout(() => {

        try {

            /*
             * ULEB128 zero
             * = 0x00
             */

            const zeroByte =
                new Uint8Array([
                    0x00
                ]);


            const before =
                data.current.slice(
                    0,
                    pattern.middleStart
                );


            const after =
                data.current.slice(
                    pattern.end
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


            if (
                type === "bytes"
            ) {

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


            setResult(
                output,
                "success",
                "UID REMOVED",
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