import type { Config } from 'tailwindcss';

export default {
  content: [
    './public/**/*.html',
    './public/js/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dbe4ff',
          500: '#4263eb',
          600: '#3b5bdb',
          700: '#2f4ac2',
          900: '#1a2f8c',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
