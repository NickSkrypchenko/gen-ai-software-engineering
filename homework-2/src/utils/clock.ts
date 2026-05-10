// Injectable clock — only services import this; domain functions accept Date as a parameter.
export const clock = {
  now: (): Date => new Date(),
};
