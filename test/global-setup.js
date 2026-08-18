const { MongoMemoryReplSet } = require('mongodb-memory-server');

module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replSet.getUri('turnos');
  process.env.DATABASE_URL = uri;
  process.env.MONGODB_URI = uri;
  globalThis.__MONGOD__ = replSet;
};
