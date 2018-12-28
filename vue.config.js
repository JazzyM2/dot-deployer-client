const Dotenv = require('dotenv-webpack');
const path = require('path')

process.env.VUE_APP_VERSION = require('./package.json').version

module.exports = {
  configureWebpack: {
    plugins: [
      new Dotenv({
        path: path.resolve(__dirname, './.env')
      })
    ]
  },
  runtimeCompiler: true,
  css: {
    loaderOptions: {
      sass: {
        data: `@import "@/styles/main.sass";`
      }
    }
  }
}
