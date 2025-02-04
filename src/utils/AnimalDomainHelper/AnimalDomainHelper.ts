import * as allAnimalsJson from './vocabulary/animals';
import ResellersDictionary from './vocabulary/resellers.json';
import AdjectivesDictionary from './vocabulary/adjectives.json';
import fetch from 'node-fetch';
import { env } from '../../env';
import {
  PremiumDomains,
  CustomImageDomains,
  DomainAttributeTrait,
} from '../metadata';
import { PROFILE_FETCH_TIMEOUT_MS } from '../common';

export type OpenSeaMetadataAttribute =
  | { trait_type?: DomainAttributeTrait; value: string | number }
  | {
      display_type:
        | 'number'
        | 'date'
        | 'boost_number'
        | 'boost_percentage'
        | 'ranking';
      trait_type: string;
      value: number;
    };

const AnimalsDictionary: Record<string, string[]> = allAnimalsJson;
const AnimalsNames: string[] = Object.values(AnimalsDictionary).flat();
const ResellerAnimalRegex = new RegExp(
  `^(${[...AdjectivesDictionary, ...ResellersDictionary].join(
    '|',
  )})?(${AnimalsNames.join('|')})[0-9]*$`,
);
const ImagesEndpoint = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images`;

export default class AnimalDomainHelper {
  getAnimalAttributes(name: string): OpenSeaMetadataAttribute[] {
    const attributes: OpenSeaMetadataAttribute[] = [];
    const { prefix, animal } = this.extractPrefixAndAnimal(name);
    if (prefix && AdjectivesDictionary.includes(prefix)) {
      attributes.push({
        trait_type: DomainAttributeTrait.Adjective,
        value: prefix,
      });
    }
    if (animal) {
      attributes.push({
        trait_type: DomainAttributeTrait.Animal,
        value: animal,
      });
    }
    return attributes;
  }

  isAnimalDomain(domainName: string): boolean {
    const { animal } = this.extractPrefixAndAnimal(domainName);
    return animal !== '';
  }

  async getAnimalImageData(domainName: string): Promise<string | undefined> {
    const imageUrl = this.getAnimalImageUrl(domainName);
    if (imageUrl) {
      const ret = await fetch(imageUrl, { timeout: PROFILE_FETCH_TIMEOUT_MS });
      return ret.text();
    }
  }

  getAnimalImageUrl(domainName: string): string | undefined {
    const { prefix, animal } = this.extractPrefixAndAnimal(domainName);
    if (animal) {
      return this.generateImageUrl(prefix, animal);
    }
    return undefined;
  }

  private generateImageUrl(prefix: string, animal: string): string | undefined {
    const normalizedPrefix = this.normalizePrefix(prefix);
    switch (normalizedPrefix) {
      case 'trust':
      case 'switcheo':
      case 'opera':
      case 'dapp':
      case 'nyc':
      case 'qtum':
      case 'dchat':
      case 'atomic':
      case 'harmony':
      case 'bounty':
      case 'zilliqa':
      case 'equal':
      case 'elja':
      case 'btg': {
        if (!AnimalsDictionary[`${normalizedPrefix}Animals`].includes(animal)) {
          return undefined;
        }
        return ImagesEndpoint + `/${normalizedPrefix}/${animal}.svg`;
      }
      default:
        if (AnimalsDictionary.ethDenverAnimals.includes(animal)) {
          return ImagesEndpoint + `/ethdenver/${animal}.svg`;
        }

        if (AnimalsDictionary.defaultAnimals.includes(animal)) {
          return ImagesEndpoint + `/animals/${animal}.svg`;
        }
        return undefined;
    }
  }

  private normalizePrefix(prefix: string): string {
    const map: Record<string, string> = {
      decentralized: 'dchat',
      awc: 'atomic',
      bnty: 'bounty',
      zil: 'zilliqa',
      eql: 'equal',
      ajoobz: 'elja',
      bitcoingold: 'btg',
    };
    return map[prefix] || prefix;
  }

  private isExcludedDomain(domainName: string) {
    if (!domainName || !domainName.includes('.')) {
      return true;
    }
    if (PremiumDomains.includes(domainName) || CustomImageDomains[domainName]) {
      return true;
    }
    return false;
  }

  private extractPrefixAndAnimal(domainName: string): {
    prefix: string;
    animal: string;
  } {
    let prefix = '';
    let animal = '';

    if (!this.isExcludedDomain(domainName)) {
      const extensionDelimiter = domainName.lastIndexOf('.');
      const label = domainName.slice(0, extensionDelimiter);
      const matches = ResellerAnimalRegex.exec(label);
      if (matches) {
        prefix = matches[1] ?? '';
        animal = matches[2] ?? '';
      }
    }
    return { prefix, animal };
  }
}
