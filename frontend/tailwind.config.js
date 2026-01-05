/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/platform-admin/**/*.{js,ts,jsx,tsx}",
    "./src/components/platform-admin/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Prevent Tailwind from conflicting with Fluent UI and Bootstrap
  corePlugins: {
    preflight: false,
  },
}
