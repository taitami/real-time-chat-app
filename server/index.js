import express from "express";
import { Server } from "socket.io";
import {fileURLToPath} from "url";
import path from "path";

const PORT = process.env.PORT || 3500;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN = "Admin"

app.use(express.static(path.join(__dirname, 'public')));

const expressServer = app.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`)
});

const usersState = {
    users: [],
    setUsers: function(newUsersArray) {
        this.users = newUsersArray  
    }
}

const io = new Server(expressServer, {
    cors: {
        origin: process.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
});

io.on('connection', socket => {
    console.log(`user ${socket.id} connected`)

    socket.on('message', data => {
        io.emit('message', `${socket.id.substring(0, 5)}: ${data}`)
    })

    socket.on('activity', name => {
        socket.broadcast.emit('activity', name)
    })
})

const buildMsg = (name, text) => {
    return { name, text, 
        time: new Intl.DateTimeFormat("default", {
            hour: "numeric",
            minute: "numeric"
        }).format(new Date())
    }
}