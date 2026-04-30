const { createApp } = require('../dist/app');
const { TransactionRepository } = require('../dist/repository/transaction.repository');
const sampleData = require('../demo/sample-data.json');

const repo = new TransactionRepository();
repo.bulkLoad(sampleData);

module.exports = createApp(repo);
