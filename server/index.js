import express from "express";
import {fileURLToPath} from "url";
import path from "path";

const PORT = process.env.PORT || 3500;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expressServer = app.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`)
});

