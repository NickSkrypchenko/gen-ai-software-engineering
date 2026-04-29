import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './public/**/*.html',
    './public/js/**/*.ts',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
