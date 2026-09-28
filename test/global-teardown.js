const fs = require('node:fs');
const path = require('node:path');

module.exports = async () => {
  const file = path.join(__dirname, '.e2e-database-url');
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};
