import { Storage } from '@google-cloud/storage';
import sinon from 'sinon';
import { expect } from 'chai';
import { Readable } from 'stream';

import { logger } from '../logger';

import { ExperimentMetadata } from './experimentalMetadata';

describe('experimentalMetadata', () => {
  let logErrorStub: sinon.SinonStub;
  let logWarnStub: sinon.SinonStub;

  let experimentMetadata: ExperimentMetadata;

  beforeEach(() => {
    experimentMetadata = new ExperimentMetadata();

    logWarnStub = sinon.stub(logger, 'warn');
    logErrorStub = sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('loadData', () => {
    it('should log an error message if file does not exist', async () => {
      const fileExistStub = sinon.stub().resolves([false]);
      const fileStub = sinon.stub().returnsThis();

      sinon.stub(Storage.prototype, 'bucket').callsFake(() => {
        return {
          file: fileStub,
          exists: fileExistStub,
        } as any;
      });

      await experimentMetadata.loadData();

      expect(fileExistStub).to.have.been.calledOnce;
      expect(logWarnStub).to.have.been.calledOnceWith(
        `Experimental Metadata - file cannot be found`,
      );
    });

    it('should load and set data', async () => {
      const fileExistStub = sinon.stub().resolves([true]);
      const fileStub = sinon.stub().returnsThis();

      let eventCount = 0;

      const createReadStreamStub = new Readable({
        objectMode: true,
        read: function (size) {
          if (eventCount < 1) {
            eventCount = eventCount + 1;
            return this.push(`{"key": "value"}`);
          } else {
            return this.push(null);
          }
        },
      });

      sinon.stub(Storage.prototype, 'bucket').callsFake(() => {
        return {
          file: fileStub,
          exists: fileExistStub,
          createReadStream: () => createReadStreamStub,
        } as any;
      });

      await experimentMetadata.loadData();
      expect(experimentMetadata.data).to.eql({
        key: 'value',
      });
    });

    it('should not load data on invalid json data', async () => {
      const fileExistStub = sinon.stub().resolves([true]);
      const fileStub = sinon.stub().returnsThis();

      let eventCount = 0;

      const createReadStreamStub = new Readable({
        objectMode: true,
        read: function (size) {
          if (eventCount < 1) {
            eventCount = eventCount + 1;
            return this.push(`not a json`);
          } else {
            return this.push(null);
          }
        },
      });

      sinon.stub(Storage.prototype, 'bucket').callsFake(() => {
        return {
          file: fileStub,
          exists: fileExistStub,
          createReadStream: () => createReadStreamStub,
        } as any;
      });

      await experimentMetadata.loadData();
      expect(experimentMetadata.data).to.eql({});

      expect(logErrorStub).to.have.been.calledOnceWith(
        `Experimental Metadata - error parsing json`,
      );
    });

    it('should not set data and throw error if loading cloud data is failed', async () => {
      const fileExistStub = sinon
        .stub()
        .rejects(new Error('something went wrong!'));

      const fileStub = sinon.stub().returnsThis();
      sinon.stub(Storage.prototype, 'bucket').callsFake(() => {
        return {
          file: fileStub,
          exists: fileExistStub,
        } as any;
      });

      await experimentMetadata.loadData();

      expect(experimentMetadata.data).to.eql({});

      expect(logErrorStub).to.have.been.calledOnceWith(
        `Experimental Metadata - error fetching data`,
      );
    });
  });

  describe('getDomainPricing', () => {
    it('should return domain pricing from data source', () => {
      experimentMetadata.data.domainPricing = {
        key: 'value',
      };

      expect(experimentMetadata.getDomainPricing()).to.eql({ key: 'value' });
    });

    it('should return default empty object if there is no domain pricing data', () => {
      experimentMetadata.data.domainPricing = undefined;

      expect(experimentMetadata.getDomainPricing()).to.eql({});
    });
  });
});
