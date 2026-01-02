/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter-Regular', 'system'],
        'sans-medium': ['Inter-Medium', 'system'],
        'sans-semibold': ['Inter-SemiBold', 'system'],
        'sans-bold': ['Inter-Bold', 'system'],
      },
      colors: {
        border: 'hsl(240, 5%, 14%)',
        input: 'hsl(240, 5%, 14%)',
        ring: 'hsl(187, 85%, 53%)',
        background: 'hsl(240, 10%, 3.9%)',
        foreground: 'hsl(0, 0%, 98%)',
        primary: {
          DEFAULT: 'hsl(187, 85%, 53%)', // Neon Cyan
          foreground: 'hsl(240, 10%, 3.9%)',
        },
        secondary: {
          DEFAULT: 'hsl(240, 5%, 12%)',
          foreground: 'hsl(0, 0%, 98%)',
        },
        destructive: {
          DEFAULT: 'hsl(0, 84%, 60%)',
          foreground: 'hsl(0, 0%, 98%)',
        },
        success: {
          DEFAULT: 'hsl(142, 69%, 58%)',
          foreground: 'hsl(240, 10%, 3.9%)',
        },
        warning: {
          DEFAULT: 'hsl(38, 92%, 50%)',
          foreground: 'hsl(240, 10%, 3.9%)',
        },
        muted: {
          DEFAULT: 'hsl(240, 5%, 16%)',
          foreground: 'hsl(240, 5%, 55%)',
        },
        accent: {
          DEFAULT: 'hsl(187, 85%, 53%)',
          foreground: 'hsl(240, 10%, 3.9%)',
        },
        popover: {
          DEFAULT: 'hsl(240, 10%, 6%)',
          foreground: 'hsl(0, 0%, 98%)',
        },
        card: {
          DEFAULT: 'hsl(240, 10%, 6%)',
          foreground: 'hsl(0, 0%, 98%)',
        },
      },
      borderRadius: {
        lg: '0.875rem', // 14px
        md: 'calc(0.875rem - 2px)',
        sm: 'calc(0.875rem - 4px)',
      },
    },
  },
  plugins: [],
};
