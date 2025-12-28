/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./ui/**/*.{tsx,ts}",
    "./shared/ui/**/*.{tsx,ts}",
    "./extension/dist/ui/*.js",
  ],
  theme: {
    extend: {
      colors: {
        'lock-blue': '#2563eb',
        'lock-purple': '#7c3aed',
      },
      spacing: {
        'lockin-safe': '16px',
      },
    },
  },
  plugins: [],
};
