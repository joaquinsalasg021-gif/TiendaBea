/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B5CF6', // Purple
        secondary: '#F59E0B', // Amber
        dark: '#1F2937',
        light: '#F3F4F6'
      },
      fontFamily: {
        sans: ['Poppins', 'Open Sans', 'sans-serif']
      }
    },
  },
  plugins: [],
}
