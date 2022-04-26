const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { Console } = require("console");
const app = express();
const port = 3002;

app.use(express.json());
app.use(cors({ origin: "*" }));

const dest = "uploads/";

let uploads = {};

app.use((req, res, next) => {
    console.log(`${req.url} ${req.method} ${JSON.stringify(req.headers)}`);
    next();
})

app.get("/upload/status", (req, res) => {
    const uniqueFileId = String(req.headers["x-file-name"]);
    const fileSize = parseInt(String(req.headers["file-size"]), 10);

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
    }

    if (!fileSize) {
        res.status(400).send("No file-size header found");
        res.end(400);
        return;
    }

    if (!uniqueFileId) {
        res.status(400).send("No x-file-name header found");
        res.end(400);
        return;
    }

    if (uniqueFileId) {
        try {
            const stats = fs.statSync(dest + uniqueFileId);
            if (stats.isFile()) {
                if (fileSize === stats.size) {
                    res.send({
                        status: "ALREADY_UPLOADED_FILE",
                        uploaded: stats.size,
                    });
                    return;
                }
                if (!uploads[uniqueFileId]) uploads[uniqueFileId] = {};
                uploads[uniqueFileId]["bytesReceived"] = stats.size;
                res.send({ uploaded: stats.size });
            }
        } catch (err) {
            const upload = uploads[uniqueFileId];
            if (upload)
                res.send({ uploaded: upload.bytesReceived, status: "RESUMED_FILE" });
            else res.send({ uploaded: 0, status: "NEW_FILE" });
        }
    }
});

app.post("/upload/files", (req, res) => {
    const uniqueFileId = String(req.headers["x-file-name"]);
    const contentRange = req.headers["content-range"];
    const match = contentRange.match(/(\d+)-(\d+)\/(\d+)/);
    const start = parseInt(match[1]);
    const fileSize = parseInt(String(req.headers["file-size"]), 10);

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
    }

    if (
        uploads[uniqueFileId] &&
        fileSize === uploads[uniqueFileId].bytesReceived
    ) {
        res.status(200).send("File already uploaded");
        res.end();
        return;
    }

    if (!uniqueFileId) {
        res.status(400).send("No x-file-name header found");
        res.end(400);
        return;
    }

    if (!uploads[uniqueFileId]) uploads[uniqueFileId] = {};
    const upload = uploads[uniqueFileId];

    let fileStream;

    if (start === 0) {
        upload.bytesReceived = 0;
        fileStream = fs.createWriteStream(`./uploads/${uniqueFileId}`, {
            flags: "w",
        });
    } else {

        if (upload.bytesReceived != start) {
            console.log("Wrong start bye");
            res.writeHead(400, "Wrong start byte");
            res.end();
            process.exit(0);
            return;
        }
        // append to existing file
        fileStream = fs.createWriteStream(`./uploads/${uniqueFileId}`, {
            flags: "a",
        });
    }


    req.pipe(fileStream);

    req.on("data", function (data) {
        console.log(`Receiver ${upload.bytesReceived} of ${uniqueFileId}`);
        upload.bytesReceived += data.length;
    });

    // when the request is finished, and all its data is written
    fileStream.on("close", function () {
        console.log(`Uploaded ${contentRange} for ${uniqueFileId}`)
        res.status(201).send({ status: "UPLOAD_COMPLETE" });
    });

    // in case of I/O error - finish the request
    fileStream.on("error", function (_err) {
        console.log(`Upload error ${contentRange} for ${uniqueFileId}`)
        res.status(500).send("File error");
        res.end();
    });
});

app.post("/upload/complete", (req, res) => {
    const uniqueFileId = String(req.headers["x-file-name"]);
    delete uploads[uniqueFileId];

    res.status(201).send({ status: "SUCCESSFULLY_UPLOADED" });
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
