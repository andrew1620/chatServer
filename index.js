const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const DataBase = require("./db/create.js");

const PORT = 3005;

// БД для хранения списка пользователей
const users = new Map();
// БД для хранения списка комнат
const rooms = new DataBase();
// БД для хранения сообщений
const messages = new Map();

// Одна комната доступна по умолчанию и должна иметь свой массив для сообщений
messages.set(0, []);

// Ф-ия для создания ответа клиенту
const createAnswer = (resultCode, message = "", data = {}) => {
  return { resultCode, message, data };
};

// Событие подключения
io.on("connection", (socket) => {
  // Закидываем в БД юзеров айдишник, по которому можно получить данные пользователя
  users.set(socket.id, new Map());

  // Добавление пользователя в БД после ввода имени
  socket.on("USER:ADD", (data, cb) => {
    if (!data.name) return cb(createAnswer(1, "Name is necessary"));

    // Проверка на наличие такого имени
    for (let user of users.values()) {
      if (user.get("name") === data.name) return cb(createAnswer(1, "The name is already taken"));
    }

    // Добавляем имя пользователя
    users.get(socket.id).set("name", data.name);
    // Отвечаем клиенту
    cb(createAnswer(0, null, { name: data.name, id: socket.id }));
    // Отправляем список комнат
    return io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms: rooms.getDb() }));
  });

  // Событие для передачи всех доступных комнат
  socket.on("ROOMS:REQUIRE", (data, cb) => {
    return cb(createAnswer(0, null, { rooms: rooms.getDb() }));
  });
  // Создание новой комнаты
  socket.on("ROOM:CREATE", (data, cb) => {
    // Генерируем айди комнаты. Использую длину массива, так как нет возможности удаления комнаты,
    // потом можно воспользоваться средствами для генерации айди
    const roomId = rooms.getDb().length;
    // Добавляем комнату в БД
    rooms.addRoom(roomId);
    // Создаем массив сообщений для комнаты
    messages.set(roomId, []);
    // ОТправляем всем список комнат
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms: rooms.getDb() }));
  });

  //Подключение к комнате
  socket.on("ROOM:JOIN", (data, cb) => {
    if (!data.roomId) return cb(createAnswer(1, `You didn't pass roomId`, null));

    // Добавляем участника в определенную комнату
    rooms.addParticipant(+data.roomId, users.get(socket.id).get("name"), socket.id);
    // Подключаем пользователя к комнате
    socket.join(+data.roomId);
    // Отправляем всем список комнат с изменившимся списком участников
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms: rooms.getDb() }));
    // В массив пользователей конкретному участнику добавляем данные о комнате, в которую он вошел
    users.get(socket.id).set("roomId", data.roomId);
    // Отвечаем клиенту
    return cb(
      createAnswer(0, null, {
        room: rooms.getRoom(+data.roomId),
        messages: messages.get(+data.roomId),
      })
    );
  });

  // Выход из комнаты
  socket.on("ROOM:LEAVE", (data, cb) => {
    // Получили комнату, в которой находился пользователь
    const roomId = +users.get(socket.id).get("roomId");
    // Отключили пользователя от комнаты
    socket.leave(roomId);
    // Удалили из списка участников комнаты
    rooms.removeParticipant(roomId, socket.id);
    // Удалили данные о комнате, которые были в данных юзера
    users.get(socket.id).delete("roomId");
    // Отправили всем список комнат
    io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms: rooms.getDb() }));
    // Ответили клиенту
    return cb(createAnswer(0, null, null));
  });
  // Прием сообщения и отправка
  socket.on("ROOM:SEND_MESSAGE", (data, cb) => {
    if (data.message === undefined) return cb(createAnswer(1, `You didn't send a message`, null));
    // Формируем новое сообщение
    const newMessage = {
      ...data.message,
      id: Date.now(),
      owner: users.get(socket.id).get("name"),
    };
    // Получаем айди комнаты, в которую надо отправить
    const roomId = +users.get(socket.id).get("roomId");

    // Проверка наличия массива сообщений по такому айди
    if (!messages.has(roomId)) messages.set("roomId", []);
    messages.get(roomId).push(newMessage);

    // Отправляем сообщение всем участникам комнаты
    io.in(roomId).emit("ROOM:MESSAGE_ADDED", createAnswer(0, null, { message: newMessage }));
    // Ответ пользователю
    return cb(createAnswer(0, null, { newMessage }));
  });
  // Отслеживание отключения пользователя
  socket.on("disconnect", () => {
    // Проверяем, отключился пользователь во время выбора чата или в чате
    // если в чате: удаляем участника из комнаты и оповещаем об удалении
    if (users.get(socket.id).has("roomId")) {
      rooms.removeParticipant(+users.get(socket.id).get("roomId"), socket.id);
      io.sockets.emit("ROOM:ADDED", createAnswer(0, null, { rooms: rooms.getDb() }));
    }
    // Удаляем из БД пользователей
    users.delete(socket.id);
  });
});

http.listen(PORT, (err) => {
  if (err) throw Error(err);
  console.log(`Server started on port ${PORT}`);
});
