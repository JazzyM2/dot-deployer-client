import axios from 'axios'
const firebase = require('firebase')

// creates an axios backend for API calls
let $backend = axios.create({
  baseURL: process.env.VUE_APP_APIURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// backend request wrapper to add firebase id token to auth header
$backend.interceptors.request.use(config => {
  return new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        user.getIdToken(true).then((token) => {
          // console.log('Token: ', token)
          config.headers['Authorization'] = `Bearer ${token}`
          resolve(config)
        })
      } else {
        reject('Please Login') // eslint-disable-line
      }
    })
  })
})

// backend functions to be exported
export default {
  getRepositories() {
    return new Promise((resolve, reject) => {
      $backend.get('repositories').then(
        response => resolve(response.data),
        error => reject(error)
      )
    })
  },
  getReleases(repoName) {
    return new Promise((resolve, reject) => {
      $backend.get(`releases?repository=${repoName}`).then(
        response => resolve(response.data),
        error => reject(error)
      )
    })
  },
  validate(deployerData) {
    return new Promise((resolve, reject) => {
      $backend.post(`validate`, deployerData).then(
        response => resolve(response.data),
        error => reject(error)
      )
    })
  }
}
