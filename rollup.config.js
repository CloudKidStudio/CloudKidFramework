import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import eslint from 'rollup-plugin-eslint';
import prettier from 'rollup-plugin-prettier';
import uglify from 'rollup-plugin-uglify';
import pkg from './package.json';
import babel from 'rollup-plugin-babel';

const prettierConfig = require('./.prettierrc');

export default [
  {
    input: 'src/index.js',
    output: [
      {
        file: pkg.module,
        format: 'es'
      }
    ],
    plugins: [
      eslint(),
      prettier(prettierConfig),
      resolve({
        module: true,
        jsnext: true,
        main: true,
        browser: true,
        preferBuiltins: false
      }),
      commonjs({
        namedExports: {
          'bellhop-iframe': ['Bellhop']
        }
      }),
      babel(),
      uglify()
    ]
  }
];