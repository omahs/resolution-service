import premiumDomains from './premium.json';
import customImageDomains from './custom-image.json';
import AnimalDomainHelper from '../AnimalDomainHelper/AnimalDomainHelper';
import { Domain } from '../../models';
import { getDomainNameLabel } from '../domain';

const PremiumDomains: string[] = premiumDomains;
const CustomImageDomains: Record<string, string> = customImageDomains;

export enum DomainAttributeTrait {
  Adjective = 'Adjective',
  Animal = 'Animal',
  Ending = 'Ending',
  Category = 'Category',
  Level = 'Level',
  Length = 'Length',
  Type = 'Type',
  Picture = 'Picture',
  AttributeCharacterSet = 'Character Set',
}

export enum AttributePictureType {
  VerifiedNft = 'verified nft',
}

export enum AttributeCharacterSet {
  None = 'none',
  Letter = 'letter',
  Alphanumeric = 'alphanumeric',
  Digit = 'digit',
}

export enum AttributeType {
  Standard = 'standard',
  Subdomain = 'subdomain',
  Animal = 'animal',
  Premium = 'premium',
  Clean = 'clean', // domain has no subdomains
}

export enum AttributeCategory {
  '999Club' = '999 Club',
  '10kClub' = '10k Club',
  '100kClub' = '100k Club',
}

export const getNumberClub = (domain: Domain): AttributeCategory | null => {
  // number clubs are only for primary domains
  if (domain.level !== 2) {
    return null;
  }
  const label = getDomainNameLabel(domain.name);
  if (
    !label ||
    getAttributeCharacterSet(domain) !== AttributeCharacterSet.Digit ||
    isNaN(+label)
  ) {
    return null;
  }
  const length = label.length;
  if (length === 3) {
    return AttributeCategory['999Club'];
  }
  if (length === 4) {
    return AttributeCategory['10kClub'];
  }
  if (length === 5) {
    return AttributeCategory['100kClub'];
  }
  return null;
};

export const getAttributeCharacterSet = (
  domain: Domain,
): AttributeCharacterSet => {
  const label = getDomainNameLabel(domain.name);

  if (!label) {
    return AttributeCharacterSet.None;
  }
  if (/^[0-9]+$/.test(label)) {
    return AttributeCharacterSet.Digit;
  }
  if (/^[A-Za-z]+$/.test(label)) {
    return AttributeCharacterSet.Letter;
  }
  if (/^[A-Za-z0-9]*$/.test(label)) {
    return AttributeCharacterSet.Alphanumeric;
  }
  return AttributeCharacterSet.None;
};

export const getAttributeCategory = (
  domain: Domain,
): AttributeCategory | null => {
  return getNumberClub(domain);
};

export const getAttributeType = async (
  domain: Domain,
): Promise<AttributeType> => {
  const AnimalHelper: AnimalDomainHelper = new AnimalDomainHelper();
  if (PremiumDomains.includes(domain.name)) {
    return AttributeType.Premium;
  }
  if (AnimalHelper.isAnimalDomain(domain.name)) {
    return AttributeType.Animal;
  }
  if (domain.level > 2) {
    return AttributeType.Subdomain;
  }
  if (!(await Domain.isNameParentOfChild(domain.name))) {
    return AttributeType.Clean;
  }
  return AttributeType.Standard;
};

export { PremiumDomains, CustomImageDomains };
