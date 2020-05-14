const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

app.get("/rooms", (req, res) => {
  res.json({ server: "works" });
});

const users = new Map();

const rooms = [
  {
    id: 0,
    participants: [],
  },
];
const messages = new Map();
messages.set(0, []);

const createAnswer = (resultCode, message = "", data = {}) => {
  return { resultCode, message, data };
};

const addParticipant = (roomId, socketId) => {
  rooms
    .find((room) => room.id === roomId)
    .participants.push({ name: users.get(socketId).get("name"), id: socketId });
  console.log("Пользователь добавился в комнату --- ", rooms);
};
const removeParticipant = (roomId, socketId) => {
  if (isNaN(roomId)) return;
  let necessaryRoom = rooms.find((room) => room.id === roomId);
  necessaryRoom.participants = necessaryRoom.participants.filter((user) => user.id !== socketId);
  console.log("Пользователь вышел с комнаты --- ", necessaryRoom);
};

io.on("connection", (socket) => {
  console.log("Пользователь подключился: ", socket.id, " ", new Date().toLocaleTimeString());
  users.set(socket.id, new Map());
  // Ф-ия добавления пользователя в БД
  socket.on("addUser", (data, cb) => {
    if (!data.name) return cb(createAnswer(1, "Name is necessary"));

    for (let user of users.values()) {
      if (user.get("name") === data.name) return cb(createAnswer(1, "The name is already taken"));
    }

    users.get(socket.id).set("name", data.name);
    cb(createAnswer(0, null, { name: data.name, id: socket.id }));
    return io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));
  });
  // Ф-ия запроса всех доступных комнат
  socket.on("requireRooms", (data, cb) => {
    console.log("Пользователем были запрошены комнаты --- ", rooms);
    return cb(createAnswer(0, null, { rooms: rooms }));
  });
  // Ф-ия отслеживания создания новых комнат
  socket.on("createRoom", (data, cb) => {
    const roomId = rooms.length;
    rooms.push({ id: roomId, participants: [] });
    messages.set(roomId, []);
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));

    return console.log("Была добавлена комната --- ", rooms);
  });
  // Ф-ия подключения к комнате
  socket.on("ROOM:JOIN", (data, cb) => {
    if (!data.roomId) return cb(createAnswer(1, `You didn't pass roomId`, null));

    socket.join(+data.roomId);
    addParticipant(+data.roomId, socket.id);
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));

    users.get(socket.id).set("roomId", data.roomId);

    return cb(
      createAnswer(0, null, {
        room: rooms.find((room) => room.id == data.roomId),
        messages: messages.get(+data.roomId),
      })
    );
  });
  // Ф-ия выхода из комнаты
  socket.on("ROOM:LEAVE", (data, cb) => {
    const roomId = +users.get(socket.id).get("roomId");

    socket.leave(roomId);
    removeParticipant(roomId, socket.id);
    users.get(socket.id).delete("roomId");

    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));
    return cb(createAnswer(0, null, null));
  });
  // Ф-ия отправки сообщения
  socket.on("ROOM:SEND_MESSAGE", (data, cb) => {
    if (data.message === undefined) return cb(createAnswer(1, `You didn't send a message`, null));

    const newMessage = {
      ...data.message,
      id: Date.now(),
      owner: users.get(socket.id).get("name"),
    };
    const roomId = +users.get(socket.id).get("roomId");

    if (!messages.has(roomId)) messages.set("roomId", []);
    messages.get(roomId).push(newMessage);

    io.in(roomId).emit("ROOM:MESSAGE_ADDED", createAnswer(0, null, { message: newMessage }));
    return cb(createAnswer(0, null, { newMessage }));
  });
  // Отслеживание отключения пользователя
  socket.on("disconnect", () => {
    if (users.get(socket.id).has("roomId")) {
      removeParticipant(+users.get(socket.id).get("roomId"), socket.id);
      io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms }));
    }
    users.delete(socket.id);
    return console.log(
      "Пользователь отключился: ",
      socket.id,
      " ",
      new Date().toLocaleTimeString()
    );
  });
});

http.listen(PORT, (err) => {
  if (err) throw Error(err);
  console.log(`Server started on port ${PORT}`);
});
