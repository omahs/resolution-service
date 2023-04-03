import { CryptoConfig, ETHContracts, MATICContracts } from '../contracts';
import connect from '../database/connect';
import { env } from '../env';
import { Domain, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import { isSupportedTLD, normalizeDomainName } from '../utils/domain';
import { eip137Namehash } from '../utils/namehash';
import SupportedKeys from 'uns/resolver-keys.json';

export enum NullAddresses {
  '0x',
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000000000000000000000000000000',
}

const blockchainNetworkIds = {
  [Blockchain.ETH]: env.APPLICATION.ETHEREUM.NETWORK_ID,
  [Blockchain.MATIC]: env.APPLICATION.POLYGON.NETWORK_ID,
};

const isNullAddress = (
  key: string | null | undefined,
): key is undefined | null => {
  if (!key) {
    return true;
  }
  return Object.values(NullAddresses).includes(key);
};

const getDomainData = async (node: string, config: CryptoConfig) => {
  const keys: string[] = [...Object.keys(SupportedKeys.keys)];
  const proxyReader = config.ProxyReader.getContract();
  const [resolver, owner, values] = await proxyReader.getData(keys, node);
  const records: Record<string, string> = {};
  keys.forEach((key, index) => {
    const value =
      (values instanceof Array ? values[index] : values?.[key]) || undefined;
    if (value) {
      records[key] = value;
    }
  });

  return {
    owner,
    resolver,
    registry: config.UNSRegistry.address,
    records,
    config,
  };
};

const getReverseResolution = async (
  address: string,
  config: CryptoConfig,
): Promise<string> => {
  const proxyReader = config.ProxyReader.getContract();
  const reverseHash = await proxyReader.reverseOf(address);
  return reverseHash._hex;
};

const constructDomain = (
  name: string,
  node: string,
  blockchain: Blockchain.ETH | Blockchain.MATIC,
  owner: string,
  resolver: string,
  registry: string,
  records: Record<string, string>,
  reverse: boolean,
): Domain => {
  const newDomain = new Domain({ name, node });
  const resolution = newDomain.getResolution(
    blockchain,
    blockchainNetworkIds[blockchain],
  );
  resolution.ownerAddress = owner;
  resolution.resolver = resolver;
  resolution.registry = registry;
  resolution.resolution = records;
  newDomain.setResolution(resolution);
  if (reverse) {
    const reverseResolution = new DomainsReverseResolution({
      reverseAddress: owner,
      blockchain: blockchain,
      networkId: blockchainNetworkIds[blockchain],
      domain: newDomain,
    });
    newDomain.setReverseResolution(reverseResolution);
  }
  return newDomain;
};

const run = async (domainName: string) => {
  const normalizedDomainName = normalizeDomainName(domainName);

  if (
    !normalizedDomainName.includes('.') ||
    !isSupportedTLD(normalizedDomainName)
  ) {
    console.log(`Unsupported domain ${domainName}`);
    return;
  }
  const node = eip137Namehash(domainName);

  const domain = await Domain.findOne({ node });
  if (domain) {
    console.log(`Domain already exists.`);
    return;
  }

  let data = await getDomainData(node, MATICContracts);
  let blockchain = Blockchain.MATIC;
  if (isNullAddress(data.owner)) {
    data = await getDomainData(node, ETHContracts);
    blockchain = Blockchain.ETH;
  }

  if (isNullAddress(data.owner)) {
    console.log(`Domain not found on-chain.`);
    return;
  }

  const reverseNode = await getReverseResolution(data.owner, data.config);
  const reverse = reverseNode === node;

  await constructDomain(
    normalizedDomainName,
    node,
    blockchain,
    data.owner,
    data.resolver,
    data.registry,
    data.records,
    reverse,
  ).save();
};

if (!process.argv[2]) {
  console.log(`Usage: ${process.argv[1]} <domainName>`);
} else {
  void connect().then(() => run(process.argv[2]));
}
