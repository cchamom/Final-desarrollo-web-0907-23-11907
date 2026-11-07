const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DB_PATH || path.join(__dirname, '..', 'biblioteca.sqlite'),
  logging: false,
});

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
});

const Room = sequelize.define('Room', {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  capacity: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT },
});

// Horas guardadas como "HH:MM" (con cero a la izquierda), por lo que
// la comparación de texto equivale a la comparación cronológica.
const Reservation = sequelize.define(
  'Reservation',
  {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    startTime: { type: DataTypes.STRING(5), allowNull: false },
    endTime: { type: DataTypes.STRING(5), allowNull: false },
  },
  { indexes: [{ fields: ['roomId', 'date'] }] }
);

Room.hasMany(Reservation, { foreignKey: { name: 'roomId', allowNull: false }, onDelete: 'CASCADE' });
Reservation.belongsTo(Room, { foreignKey: 'roomId' });
User.hasMany(Reservation, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
Reservation.belongsTo(User, { foreignKey: 'userId' });

module.exports = { sequelize, User, Room, Reservation };
