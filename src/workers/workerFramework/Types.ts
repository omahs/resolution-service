export type Event = {
  type: string;
  args: Record<string, string>;
};

export type Block = {
  blockNumber: number;
  blockHash: string;
};
