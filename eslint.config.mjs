import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: [
      'src/app/admin/page.tsx',
      'src/app/admin/draft/page.tsx',
      'src/app/admin/teams/page.tsx',
      'src/app/admin/users/page.tsx',
    ],
    rules: {
      // These legacy 2025 screens will be removed as their new commissioner
      // workflows land. Keep them buildable during the additive migration.
      'react-hooks/immutability': 'off',
    },
  },
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'supabase/.branches/**',
    'supabase/.temp/**',
    'next-env.d.ts',
  ]),
])
