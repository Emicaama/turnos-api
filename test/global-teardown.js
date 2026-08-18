module.exports = async () => {
  if (globalThis.__MONGOD__) {
    await globalThis.__MONGOD__.stop();
  }
};
