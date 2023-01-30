module.exports = {
  workers: {
    MyWorker: {
      // put worker config overrides here, for example:
      handleReorgs: true,
      blockFetchLimit: 500,
      eventsStartingBlock: 12779230,
      maxReorgSize: 200,
      networkId: 1,
      blockchain: 'ETH',
    },
  },
};
