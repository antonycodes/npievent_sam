/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Event brand + status palette (finalized in later steps)
        occupied: '#dc2626', // red-600  -> isOccupied: true
        vacant: '#16a34a',   // green-600 -> isOccupied: false
        brand: '#e30613',    // cellphoneS red accent
      },
    },
  },
  plugins: [],
};
