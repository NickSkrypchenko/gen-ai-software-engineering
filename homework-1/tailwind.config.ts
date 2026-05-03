import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './public/**/*.html',
    './public/js/**/*.ts',
  ],
  safelist: [
    // Dynamically applied by JS
    'hidden', 'opacity-0', 'opacity-100',
    'translate-x-full', 'translate-x-0',
    'translate-y-0', 'translate-y-4',
    'overflow-hidden',
    'reveal-in',
    // Health pill dynamic colours
    'text-green-600', 'border-green-200', 'bg-green-50',
    'text-red-500',   'border-red-200',   'bg-red-50',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
