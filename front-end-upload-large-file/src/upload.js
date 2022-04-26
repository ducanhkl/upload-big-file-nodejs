

import { Button, Progress, Upload } from "antd";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { UploadOutlined } from '@ant-design/icons';

const chunkSize = 10000;


const defaultUploadState = {
    fileSize: 0,
    fileId: "",
    totalChunks: 0,
    totalChunksUploaded: 0,
    startChunk: 0,
    endChunk: chunkSize,
    fileToUpload: null,
    uploadedBytes: 0,
}

export const UploadComponent = () => {

    const [showProgress, setShowProgress] = useState(false);
    const [progress, setProgress] = useState(0);
    const [fileState, setFileState] = useState({
        ...defaultUploadState,
    });

    const [preUploadFileState, setPreUploadFileState] = useState({
        ...defaultUploadState,
    })



    const resetState = () => {
        setPreUploadFileState({
            fileSize: 0,
            fileId: "",
            totalChunks: 0,
            totalChunksUploaded: 0,
            startChunk: 0,
            endChunk: chunkSize,
            fileToUpload: null,
            uploadedBytes: 0,
        });
    };

    const uploadChunk = (chunk) => {
        console.table({ ...fileState, fileToUpload: "" });
        const {
            fileId,
            startChunk,
            endChunk,
            fileSize,
            totalChunksUploaded,
            uploadedBytes,
        } = fileState;
        axios
            .post("http://localhost:3002/upload/files", chunk, {
                headers: {
                    "x-file-name": fileId,
                    "Content-Range": `bytes ${startChunk}-${endChunk}/${fileSize}`,
                    "file-size": fileSize,
                },
            })
            .then(({ data }) => {
                const endingChunk = Math.min(endChunk + chunkSize, fileSize);

                setFileState({
                    ...fileState,
                    totalChunksUploaded: totalChunksUploaded + 1,
                    startChunk: endChunk,
                    endChunk: endingChunk === fileSize ? endingChunk + 1 : endingChunk,
                    uploadedBytes: endingChunk,
                });
                const prog = fileSize ? (uploadedBytes / fileSize) * 100 : 0.1;
                setProgress(prog);
            });
    };

    const fileUpload = (totalChunksUploaded) => {
        const {
            totalChunks,
            fileToUpload,
            startChunk,
            endChunk,
            fileId,
        } = fileState;
        if (totalChunksUploaded <= totalChunks) {
            var chunk = fileToUpload.slice(startChunk, endChunk);
            uploadChunk(chunk);
        } else {
            axios
                .post("http://localhost:3002/upload/complete", {
                    headers: {
                        "x-file-name": fileId,
                    },
                })
                .then(resetState);
        }
    };

    useEffect(() => {
        if (fileState.fileSize > 0) {
            fileUpload(fileState.totalChunksUploaded);
        }
    }, [fileState.fileSize, fileState.totalChunksUploaded]);



    const getFileContext = (e) => {

        console.log("change value 1111")

        setShowProgress(true);
        setProgress(0);
        resetState();

        const file_obj = e.fileList[0].originFileObj;
        const fileId = `${file_obj.size}-${file_obj.lastModified}-${file_obj.name}`;

        axios
            .get("http://localhost:3002/upload/status", {
                headers: {
                    "x-file-name": fileId,
                    "file-size": file_obj.size,
                },
            })
            .then(({ data }) => {
                const uploadedBytes = data.uploaded;
                const bytesRemaining = file_obj.size - uploadedBytes;
                console.log("uploaded bytes ", uploadedBytes);
                console.log("Byte remaining", bytesRemaining);
                const endingChunk = Math.min(uploadedBytes + chunkSize, file_obj.size);
                setPreUploadFileState({
                    fileSize: file_obj.size,
                    fileId,
                    totalChunks: Math.ceil(bytesRemaining / chunkSize),
                    totalChunksUploaded: 0,
                    startChunk: uploadedBytes,
                    endChunk:
                        endingChunk === fileState.fileSize ? endingChunk + 1 : endingChunk,
                    fileToUpload: file_obj,
                    uploadedBytes,
                });
            })
            .catch((err) => console.error("Status call failed ", err));
    };


    return (<>
        <div>
            <Upload onChange={getFileContext} >
                <Button icon={<UploadOutlined />}>Choose file</Button>
            </Upload>
            <Button onClick={() => {
                setFileState({
                    ...preUploadFileState
                })
            }}>
                Upload
            </Button>
            {showProgress && <Progress percent={progress} />}
        </div>
    </>)
}