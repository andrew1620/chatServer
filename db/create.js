// Класс для создания БД комнат
class DataBase {
  constructor() {
    this.db = [{ id: 0, participants: [] }];
  }
  // Получение массива
  getDb() {
    return this.db;
  }
  // Установка массива
  setDb(newDB) {
    return (this.db = newDB.slice());
  }
  // Добавление комнаты в массив
  addRoom(roomId) {
    this.db.push({ id: roomId, participants: [] });
  }
  // Получением комнаты по айди
  getRoom(roomId) {
    return this.db.find((room) => room.id === roomId);
  }
  // Удаление комнаты по айди
  deleteRoom(roomId) {
    const requiredIndex = this.db.findIndex((room) => room.id === roomId);
    if (requiredIndex !== -1) this.db.splice(requiredIndex, 1);
    else console.log("There is no room with such ID");
  }
  // Добавлени участника в комнату
  addParticipant(roomId, name, socketId) {
    this.db.find((room) => room.id === roomId).participants.push({ name, id: socketId });
  }
  // Удаление участника из комнаты
  removeParticipant(roomId, socketId) {
    if (isNaN(roomId)) return;
    const necessaryRoom = this.db.find((room) => room.id === roomId);
    necessaryRoom.participants = necessaryRoom.participants.filter((user) => user.id !== socketId);
  }
}

module.exports = DataBase;
