import express from "express";
import { Server } from "socket.io";
import {fileURLToPath} from "url";
import path from "path";
import http from "http"
import dotenv from "dotenv"
import cors from "cors"

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
const PORT = process.env.PORT || 3500;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN = "Admin"

app.use(cors({ 
    origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"], 
}));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));


const usersState = {
    users: [],
    setUsers: function(newUsersArray) {
        this.users = newUsersArray  
    }
}

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

io.on('connection', socket => {
    console.log(`user ${socket.id} connected`)

    socket.on('enterRoom', ({name, room}) => {
        const prevRoom = getUser(socket.id)?.room
        if (prevRoom) {
            socket.leave(prevRoom)
        }

        const user = activateUser(socket.id, name, room)
        if (prevRoom) {
            io.to(prevRoom).emit("userList", {
                users: getUsersInRoom(prevRoom)
            })
        }

        socket.join(user.room)
        io.to(user.room).emit("userList", {
            users: getUsersInRoom(user.room)
        })

        io.emit("roomList", {
            rooms: getAllActiveRooms()
        })
    })


    socket.on('message', ({name, text}) => {
        const room = getUser(socket.id)?.room
        if (room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
    })

    socket.on('activity', name => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
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

const activateUser = (id, name, room) => {
    const user = { id, name, room }
    usersState.setUsers([
        ...usersState.users.filter(user => user.id !== id),
        user
    ])
    return user
}

const userLeavesApp = (id) => {
    usersState.setUsers(
        usersState.users.filter(user => user.id !== id)
    )
}

const getUsersInRoom = (room) => {
    return usersState.users.filter(user => user.room === room)
}

const getAllActiveRooms = () => {
    return Array.from(new Set(usersState.users.map(user => user.room)))
}