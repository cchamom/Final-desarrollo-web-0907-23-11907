const bcrypt = require('bcryptjs');
const { sequelize, User, Room } = require('./db');

async function seed({ force = false } = {}) {
  await sequelize.sync({ force });

  if ((await User.count()) === 0) {
    await User.bulkCreate([
      { username: 'ana', name: 'Ana López', passwordHash: await bcrypt.hash('ana123', 10) },
      { username: 'luis', name: 'Luis Pérez', passwordHash: await bcrypt.hash('luis123', 10) },
    ]);
  }

  if ((await Room.count()) === 0) {
    await Room.bulkCreate([
      { name: 'Sala Cervantes', capacity: 4, description: 'Sala pequeña para estudio en grupo.' },
      { name: 'Sala Asturias', capacity: 8, description: 'Mesa grande y pizarra.' },
      { name: 'Sala Neruda', capacity: 12, description: 'Proyector y pantalla.' },
      { name: 'Cubículo 1', capacity: 1, description: 'Estudio individual silencioso.' },
    ]);
  }
}

module.exports = seed;

if (require.main === module) {
  seed({ force: process.argv.includes('--force') })
    .then(() => {
      console.log('Base de datos lista. Usuarios: ana/ana123, luis/luis123');
      return sequelize.close();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
