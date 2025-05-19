import express from "express";
import { Server } from "socket.io";
import {fileURLToPath} from "url";
import path from "path";

const PORT = process.env.PORT || 3500;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expressServer = app.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`)
});

const io = new Server(expressServer, {
    cors: {
        origin: process.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
});