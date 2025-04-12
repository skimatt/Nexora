/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}", // ← penting jika kamu pakai Next.js
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}", // ← jika kamu pakai folder app
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
