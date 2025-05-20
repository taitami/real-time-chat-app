const socket = io('ws://localhost:3500');

const activity = document.querySelector(".activity")
const msgInput = document.querySelector("#message")
const nameInput = document.querySelector("#name")
const chatRoom = document.querySelector("#room")
const usersList = document.querySelector(".user-list")
const roomsList = document.querySelector(".room-list")
const chatDisplay = document.querySelector(".chat-display")

const enterRoom = (e) => {
    e.preventDefault()
    if (nameInput.value && chatRoom.value) {
        socket.emit('enterRoom', {
            name: nameInput.value,
            room: chatRoom.value
        })
    }
}

const sendMessage = (e) => {
    e.preventDefault()
    if (nameInput.value && chatRoom.value && msgInput.value) {
        socket.emit('message', {
            text: msgInput.value,
            name: nameInput.value
        })
        msgInput.value = ""
    }
    msgInput.focus()
};

document.querySelector('form')
    .addEventListener('submit', sendMessage);

socket.on("message", (data) => {
    activity.textContent = ""
    const li = document.createElement('li')
    li.textContent = data
    document.querySelector('ul').appendChild(li)
})    

msgInput.addEventListener('keypress', () => {
    socket.emit("activity", socket.id.substring(0, 5));
});

let activityTimer
socket.on("activity", name => {
    activity.textContent = `${name} is typing`

    clearTimeout(activityTimer)
    activityTimer = setTimeout(() => {
        activity.textContent = ""
    }, 500)
})