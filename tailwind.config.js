/** @type {import('tailwindcss').Config} */

// ── Enterprise design tokens ─────────────────────────────────────────
const ent = require('./design-tokens/design-tokens.enterprise.json');

module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    safelist: [
      // Theme & density utility classes used dynamically on <body>
      'theme-enterprise', 'density-compact', 'density-comfortable',
    ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
        // Enterprise radius tokens
        'ent-sm': `${ent.radius.sm}px`,
        'ent-md': `${ent.radius.md}px`,
        'ent-lg': `${ent.radius.lg}px`,
  		},
      boxShadow: {
        'ent-sm': ent.shadow.sm,
      },
      fontSize: {
        'ent-h1':      [`${ent.type.h1.size}px`, { fontWeight: ent.type.h1.weight }],
        'ent-h2':      [`${ent.type.h2.size}px`, { fontWeight: ent.type.h2.weight }],
        'ent-h3':      [`${ent.type.h3.size}px`, { fontWeight: ent.type.h3.weight }],
        'ent-body':    [`${ent.type.body.size}px`, { fontWeight: ent.type.body.weight }],
        'ent-caption': [`${ent.type.caption.size}px`, { fontWeight: ent.type.caption.weight }],
      },
      spacing: {
        'ent-xs':  `${ent.space.xs}px`,
        'ent-sm':  `${ent.space.sm}px`,
        'ent-md':  `${ent.space.md}px`,
        'ent-lg':  `${ent.space.lg}px`,
        'ent-xl':  `${ent.space.xl}px`,
        'ent-xxl': `${ent.space.xxl}px`,
      },
  		colors: {
        // Enterprise brand palette — available as text-ent-brand, bg-ent-accent etc.
        'ent-brand':       ent.color.brand,
        'ent-accent':      ent.color.accent,
        'ent-success':     ent.color.success,
        'ent-warn':        ent.color.warn,
        'ent-danger':      ent.color.danger,
        'ent-neutral': {
          900: ent.color['neutral-900'],
          700: ent.color['neutral-700'],
          500: ent.color['neutral-500'],
          200: ent.color['neutral-200'],
           50: ent.color['neutral-50'],
        },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}