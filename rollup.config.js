import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

export default [
  // ===== JS 构建 =====
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.esm.js', format: 'es' },
      { file: 'dist/index.cjs.js', format: 'cjs', exports: 'named' }
    ],
    // 必须 external
    external: ['dexie', 'tslib'],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        importHelpers: true
      })
    ]
  },

  // ===== d.ts 构建 =====
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
    external: ['dexie']
  }
]
