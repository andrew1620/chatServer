const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

app.get("/rooms", (req, res) => {
  res.json({ server: "works" });
});

const users = new Map();
users.set(25, "Petter");
const rooms = [
  {
    id: 0,
    participants: [
      { name: "John", id: "userId" },
      { name: "Petter", id: "userId" },
    ],
  },
];
const messages = new Map();
messages.set(0, [{ owner: "John", time: "22:00", message: "Hello" }]);

const createAnswer = (resultCode, message = "", data = {}) => {
  return { resultCode, message, data };
};

const addParticipant = (roomId, socketId) => {
  rooms
    .find((room) => room.id === roomId)
    .participants.push({ name: users.get(socketId), id: socketId });
  console.log(rooms);
};
const removeParticipant = (roomId, socketId) => {
  let necessaryRoom = rooms.find((room) => room.id === roomId);
  necessaryRoom.participants = necessaryRoom.participants.filter((user) => user.id !== socketId);
  console.log(necessaryRoom);
};
// addParticipant(0, 25);
// console.log(" before deleting --- ", rooms);
// removeParticipant(0, 25);
// console.log("after deleteting", rooms[0].participants);

io.on("connection", (socket) => {
  console.log("Пользователь подключился: ", socket.id, " ", new Date().toLocaleTimeString());
  // Ф-ия добавления пользователя в БД
  socket.on("addUser", (data, cb) => {
    if (!data.name) return cb(createAnswer(1, "Name is necessary"));
    for (let name of users.values()) {
      if (name === data.name) return cb(createAnswer(1, "The name is already taken"));
    }
    users.set(socket.id, data.name);
    console.log("add user --- ", users);
    cb(createAnswer(0, null, { name: data.name, id: socket.id }));
    return io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));
  });
  // Ф-ия запроса всех доступных комнат
  socket.on("requireRooms", (data, cb) => {
    console.log("require rooms --- ", rooms);
    return cb(createAnswer(0, null, { rooms: rooms }));
  });
  // Ф-ия отслеживания создания новых комнат
  socket.on("createRoom", (data, cb) => {
    const roomId = rooms.length;
    rooms.push({ id: roomId, participants: [] });
    messages.set(roomId, []);
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));

    console.log("rooms added --- ", rooms);
  });
  // Ф-ия подключения к комнате
  socket.on("ROOM:JOIN", (data, cb) => {
    if (!data.roomId) return cb(createAnswer(1, `You didn't pass roomId`, null));

    socket.join(+data.roomId);
    addParticipant(+data.roomId, socket.id);
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));

    return cb(
      createAnswer(0, null, {
        room: rooms.find((room) => room.id == data.roomId),
        messages: messages.get(+data.roomId),
      })
    );
  });
  // Ф-ия выхода из комнаты
  socket.on("ROOM:LEAVE", (data, cb) => {
    if (data.roomId === null) return cb(createAnswer(1, `You didn't pass roomId`, { data }));

    socket.leave(data.roomId);
    removeParticipant(data.roomId, socket.id);
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));
    return cb(createAnswer(0, null, null));
  });
  // Ф-ия отправки сообщения
  socket.on("ROOM:SEND_MESSAGE", (data, cb) => {
    if (!data.message || data.roomId === null)
      return cb(createAnswer(1, `You didn't send a message or roomId`, null));

    const newMessage = { ...data.message, id: Date.now(), owner: users.get(socket.id) };
    if (!messages.has(data.roomId)) messages.set(roomId, []);
    messages.get(data.roomId).push(newMessage);

    io.in(data.roomId).emit("ROOM:MESSAGE_ADDED", createAnswer(0, null, { message: newMessage }));
    return cb(createAnswer(0, null, { newMessage }));
  });
  // Отслеживание отключения пользователя
  socket.on("disconnect", () => {
    console.log("Пользователь отключился: ", socket.id, " ", new Date().toLocaleTimeString());
    users.delete(socket.id);
  });
});

http.listen(PORT, (err) => {
  if (err) throw Error(err);
  console.log(`Server started on port ${PORT}`);
});
