export type Clock = () => Date;

export const realClock: Clock = () => new Date();
