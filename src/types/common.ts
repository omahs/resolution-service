export type KeysOfType<T, TProp> = NonNullable<
  {
    [P in keyof T]: T[P] extends TProp ? P : never;
  }[keyof T]
> &
  string &
  keyof T;

export type AnyFunction = (...args: any[]) => any;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructed = Pick<Object, 'constructor'>;

export type UnwrapArray<T> = T extends Array<infer U> ? U : T;
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapFunction<T> = T extends () => any ? ReturnType<T> : T;
export type PossiblePromise<T, U = Promise<T>> = T extends Promise<infer V>
  ? T | V
  : T | U;
export type PossibleFunction<T> = T extends () => any
  ? T | UnwrapFunction<T>
  : T | (() => T);
export type PossibleArray<T> = T extends any[] ? T | UnwrapArray<T> : T | T[];
export type Dictionary<T> = Record<string, T>;
export type NonFunction<T> = T extends AnyFunction ? never : T;

export type Require<T, P extends keyof T> = Partial<T> & Pick<T, P>;

type ValidationBase = boolean | undefined | null;
type ValidationMethod = () => Promise<ValidationBase> | ValidationBase;
export type ValidationProperty<T> = KeysOfType<
  T,
  ValidationMethod | ValidationBase
>;
export type ValidationCallback<T> = (
  object: T,
) => PossiblePromise<ValidationBase>;

export type Attributes<T> = Omit<
  { [P in keyof T]?: UnwrapPromise<T[P]> | T[P] },
  KeysOfType<T, AnyFunction>
>;

export type Attribute<T> = {
  [P in keyof T]: T[P] extends AnyFunction ? never : P;
}[keyof T] &
  string;

export type SerializableBase = boolean | string | number | null | undefined;
export type Serializable = {
  [k: string]: SerializableBase | Serializable | SerializableArray;
};
export type SerializableArray = (SerializableBase | Serializable)[];
export type MetadataImageFontSize = 24 | 20 | 18 | 16;

export enum Blockchain {
  ETH = 'ETH',
  ZIL = 'ZIL',
  MATIC = 'MATIC',
}

export const Blockchains = Object.values(Blockchain);

export enum EvmUnstoppableDomainTlds {
  Crypto = 'crypto',
  Bitcoin = 'bitcoin',
  Blockchain = 'blockchain',
  Coin = 'coin',
  Unstoppable = 'unstoppable',
  Dao = 'dao',
  Nft = 'nft',
  Number888 = '888',
  Wallet = 'wallet',
  X = 'x',
  Klever = 'klever',
  Hi = 'hi',
  Kresus = 'kresus',
  Polygon = 'polygon',
}

export enum ZilliqaUnstoppableDomainTlds {
  Zil = 'zil',
}

export type UnstoppableDomainTld =
  | EvmUnstoppableDomainTlds
  | ZilliqaUnstoppableDomainTlds;

export const UnstoppableDomainTlds = {
  ...EvmUnstoppableDomainTlds,
  ...ZilliqaUnstoppableDomainTlds,
};

// TLDs not issued by Unstoppable Domains
// We may allow people to manage domains not issued by UD (e.g., ".eth")
export enum ExternalDomainTld {}

export type AllDomainTlds =
  | EvmUnstoppableDomainTlds
  | ZilliqaUnstoppableDomainTlds
  | ExternalDomainTld;

export const SupportedTlds = [
  UnstoppableDomainTlds.Crypto,
  UnstoppableDomainTlds.Bitcoin,
  UnstoppableDomainTlds.Blockchain,
  UnstoppableDomainTlds.Dao,
  UnstoppableDomainTlds.Nft,
  UnstoppableDomainTlds.Number888,
  UnstoppableDomainTlds.Wallet,
  UnstoppableDomainTlds.X,
  UnstoppableDomainTlds.Klever,
  UnstoppableDomainTlds.Zil,
  UnstoppableDomainTlds.Hi,
  UnstoppableDomainTlds.Kresus,
  UnstoppableDomainTlds.Polygon,
];

export const DeprecatedTlds = [UnstoppableDomainTlds.Coin];

export type SupportedTld = typeof SupportedTlds[number];
export type DeprecatedTld = typeof DeprecatedTlds[number];

export type WalletAddress = string;
export const DeadAdresses: Array<WalletAddress> = [
  '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead',
];

export enum HttpMethods {
  CONNECT = 'CONNECT',
  DELETE = 'DELETE',
  GET = 'GET',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
  TRACE = 'TRACE',
}

export const DomainOperationTypes = [
  'Transfer',
  'Resolve',
  'NewURI',
  'Sync',
  'Set',
  'ResetRecords',
  'SetReverse',
] as const;

export const OperationTypesWithoutNode = [
  'RemoveReverse',
  'Approval',
  'ApprovalForAll',
] as const;

export const ContractManagementTypes = [
  'NewURIPrefix',
  'Upgraded',
  'AdminChanged',
] as const;

export const EventTypes = [
  ...DomainOperationTypes,
  ...OperationTypesWithoutNode,
  ...ContractManagementTypes,
] as const;

export type EventType = typeof EventTypes[any];
