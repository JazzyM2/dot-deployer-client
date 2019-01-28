import axios from 'axios'
import GitHub from './github.js'
const requestPromise = require('request-promise')

// creates an ios backend for cloud functions
let $cloudFunctions = axios.create({
  baseURL: process.env.VUE_APP_APIURL,
  timeout: 30000,
  headers: {
    Accept: 'application/json'
  }
})

// creates an axios backend for github api calls
let $github = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 30000,
  headers: {
    Accept: 'application/vnd.github.machine-man-preview+json'
  }
})

// request wrapper to add github token to auth header
$github.interceptors.request.use(config => {
  return new Promise((resolve, reject) => {
    GitHub.requestToken().then((token) => {
      config.headers['Authorization'] = `token ${token}`
      resolve(config)
    }).catch((error) => {
      reject(error)
    })
  })
})

// export backend functions for use in store module
export default {
  validate(deployerData) {
    return new Promise((resolve, reject) => {
      $cloudFunctions.post(`validate`, deployerData).then(
        response => resolve(response.data),
        error => reject(error)
      )
    })
  },
  getRepositories() {
    return new Promise((resolve, reject) => {
      $github.get('installation/repositories').then(
        response => resolve(response.data),
        error => reject(error)
      )
    })
  },
  getReleases(repoName) {
    return new Promise((resolve, reject) => {
      $github.get(`repos/${repoName}/releases`).then(
        response => resolve(response.data),
        error => reject(error)
      )
    })
  },
  getAsset(repoName, assetId) {
    // using standard rquest library to avoid limitations with axios
    return new Promise((resolve, reject) => {
      GitHub.requestToken().then((token) => {
        const options = {
          url: `https://api.github.com/repos/${repoName}/releases/assets/${assetId}`,
          encoding: null,
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/octet-stream',
            'User-Agent': 'Dot Deployer'
          }
        }
        requestPromise(options).then(asset => {
          resolve(asset)
        }).catch((error) => {
          reject(error)
        })
      })
    })
  },
  getSource(repoName, tagName) {
    // using standard rquest library to avoid limitations with axios
    return new Promise((resolve, reject) => {
      GitHub.requestToken().then((token) => {
        const options = {
          url: `https://api.github.com/repos/${repoName}/zipball/${tagName}`,
          encoding: null,
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.machine-man-preview+json',
            'User-Agent': 'Dot Deployer'
          }
        }
        requestPromise(options).then(source => {
          resolve(source)
        }).catch((error) => {
          reject(error)
        })
      })
    })
  }
}
