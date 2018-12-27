import backend from '../backend'
import firebase from 'firebase'
import {
  ownerName,
  ownerId
} from '../helpers'

const fs = require('fs-extra')
const request = require('request')
const _ = require('lodash')

const baseURL = process.env.VUE_APP_APIURL

const state = {
  // deployer github repo id
  supports: ['2.0.0'],
  message: null,
  deploying: false,
  progress: null,
  modalActive: false,
  downloadSelected: null,
  admins: {},
  installs: {},
  repositories: {},
  contents: {},
  releases: {},
  downloads: {},
  deployers: {},
  github: 0
}

const mutations = {
  addMessage(state, message) {
    state.message = message
  },
  setDeploying(state, bool) {
    state.deploying = bool
  },
  setProgress(state, payload) {
    state.progress = payload
  },
  setModalActive(state, bool) {
    state.modalActive = bool
  },
  setDownloadSelected(state, payload) {
    state.downloadSelected = payload
  },
  popMessage(state) {
    state.message = null
  },
  setRepositories(state, repositories) {
    state.repositories = repositories
  },
  setAdmins(state, admins) {
    state.admins = admins
  },
  setInstalls(state, installs) {
    state.installs = installs
  },
  setDownloads(state, downloads) {
    state.downloads = downloads
  },
  setContents(state, payload) {
    state.contents[payload.name] = payload.contents
  },
  setReleases(state, payload) {
    state.releases[payload.name] = payload.releases
  },
  setDeployers(state, payload) {
    state.deployers[payload.name] = payload.deployer
  },
  refreshGithub(state) {
    state.github = state.github + 1
  }
}

const actions = {
  // updateRollbarConfig: (context, user) => {
  //   rollbar.configure({
  //     'enabled': true,
  //     'payload': {
  //       'person': {
  //         'id': user.uid,
  //         'username': user.displayName,
  //         'email': user.email
  //       }
  //     }
  //   })
  // },
  setDeploying: (context, bool) => {
    return context.commit('setDeploying', bool)
  },
  setProgress: (context, payload) => {
    return context.commit('setProgress', payload)
  },
  setModalActive: (context, bool) => {
    return context.commit('setModalActive', bool)
  },
  setDownloadSelected: (context, payload) => {
    return context.commit('setDownloadSelected', payload)
  },
  flashMessage: (context, message) => {
    context.commit('addMessage', message)
    setTimeout(function () {
      context.commit('popMessage')
    }, 3000)
  },
  fireListener: (context, ref) => {
    return new Promise((resolve, reject) => {
      firebase.database().ref(ref.db).on('value', function (snapshot) {
        context.commit(ref.store, snapshot.val())
        resolve()
      }, function (error) {
        reject(error.code)
      })
    })
  },
  pullGitHub: (context) => {
    return new Promise((resolve, reject) => {
      // refresh github information on login
      context.dispatch('repositories').then(() => {
        let releases = []
        _.forEach(context.state.repositories.repositories, (repo) => {
          releases.push(context.dispatch('releases', repo))
        })
        Promise.all(releases).then(() => {
          resolve()
        }, (error) => {
          reject(error)
        })
      }, (error) => {
        reject(error)
      })
    })
  },
  githubListener: () => {
    // this listener will trigger anytime data is removed from db.github
    // a github webhook pushes the update to the database, and a cloud function automatically removes it
    // this action will trigger the below listener
    return firebase.database().ref('github').on('child_removed', (snapshot) => {
      const snapshotData = snapshot.val()
      console.log('GitHub Action: ', snapshotData)

      // TODO fetch available repositories if github action is such
      // context.dispatch('repositories')

      // TODO fetch new contents and releases if github action is such
      // const identity = ownerName(repo)
      // context.dispatch('contents', identity)
      // context.dispatch('releases', identity)
      // context.dispatch('getFileJSON', {
      //   name: repo.name,
      //   path: '.deployer',
      //   repository: identity
      // })
      // context.commit('refreshGithub')
    });
  },
  updateInstall: (context, payload) => {
    return new Promise((resolve) => {
      let computerId = process.env.COMPUTERNAME
      let user = firebase.auth().currentUser.email
      let update = {}
      update[payload.repo] = {}
      update[payload.repo].tag = payload.tag
      firebase.database().ref(`installs/${computerId}`).update({
        user: user
      })
      firebase.database().ref(`installs/${computerId}/installs`).update(update).then(() => {
        resolve()
      })
    })
  },
  removeInstall: (context, repo) => {
    return new Promise((resolve) => {
      let computerId = process.env.COMPUTERNAME
      firebase.database().ref(`installs/${computerId}/installs/${repo}`).remove()
      resolve()
    })
  },
  addAdmin: (context, email) => {
    firebase.database().ref('admins').push({
      email: email
    })
  },
  deleteAdmin: (context, key) => {
    firebase.database().ref('admins/' + key).remove()
  },
  addRepo: (context, repo) => {
    return new Promise((resolve) => {
      let payload = _.cloneDeep(repo)
      payload.added_by = {}
      payload.added_by.email = firebase.auth().currentUser.email
      payload.added_by.photo = firebase.auth().currentUser.photoURL
      firebase.database().ref('repositories').push(payload)
      resolve()
    })
  },
  deleteRepo: (context, key) => {
    return new Promise((resolve) => {
      firebase.database().ref('repositories/' + key).remove()
      resolve()
    })
  },
  repositories: (context) => {
    return new Promise((resolve, reject) => {
      backend.getRepositories().then(
        response => resolve(context.commit('setRepositories', response)),
        error => reject(error)
      )
    })
  },
  // contents: (context, repo) => {
  //   const identity = ownerId(repo)
  //   const identityName = ownerName(repo)
  //   return new Promise((resolve, reject) => {
  //     backend.getContents(identityName).then(
  //       response => resolve(context.commit('setContents', {
  //         name: identity,
  //         contents: response
  //       })),
  //       error => reject(error)
  //     )
  //   })
  // },
  releases: (context, repo) => {
    const identity = ownerId(repo)
    const identityName = ownerName(repo)
    return new Promise((resolve, reject) => {
      backend.getReleases(identityName).then(
        response => resolve(context.commit('setReleases', {
          name: identity,
          releases: response
        })),
        error => reject(error)
      )
    })
  },
  validate: (context, deployerData) => {
    return new Promise((resolve, reject) => {
      backend.validate(deployerData).then(
        response => resolve(response),
        error => reject(error)
      )
    })
  },
  // axios backend forces encoding on a binary response
  // this action uses a standard request module to get around that
  asset: (context, payload) => {
    return new Promise((resolve, reject) => {
      const path = `${process.env.TEMP}\\${payload.name}`
      const url = `${baseURL}asset?id=${payload.id}&repository=${payload.repository}`
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          user.getIdToken(true).then((token) => {
            request({
              url: url,
              encoding: null,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }, (error, resp, body) => {
              if (error) {
                reject(error)
              } else {
                fs.remove(path).then(() => {
                  fs.outputFile(path, body, (error) => {
                    if (error) {
                      reject(error)
                    } else {
                      resolve()
                    }
                  })
                })
              }
            })
          })
        } else {
          reject('Please login') // eslint-disable-line
        }
      })
    })
  },
  getFileJSON: (context, payload) => {
    return new Promise((resolve, reject) => {
      const path = `${process.env.TEMP}\\${payload.name}.json`
      const url = `${baseURL}file?path=${payload.path}&repository=${payload.ownerName}`
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          user.getIdToken(true).then((token) => {
            request({
              url: url,
              encoding: null,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }, (error, resp, body) => {
              if (error) {
                reject(error)
              } else {
                // create the .deployer file for chosen repository
                fs.outputFile(path, body).then(() => {
                  // read file to create / verify json!
                  fs.readJson(path).then((deployerData) => {
                    context.commit('setDeployers', {
                      name: payload.ownerId,
                      deployer: deployerData
                    })
                    resolve()
                  }).catch(() => {
                    context.commit('setDeployers', {
                      name: payload.ownerId,
                      deployer: null
                    })
                    resolve()
                  })
                }).catch(() => {
                  reject(`Failed to write file to ${payload.path}`) // eslint-disable-line
                })
              }
            })
          })
        } else {
          reject('Please login') // eslint-disable-line
        }
      })
    })
  },
  download: (context, payload) => {
    return new Promise((resolve, reject) => {
      const path = `${process.env.TEMP}\\${payload.name}.zip`
      const url = `${baseURL}download?url=${payload.url}`
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          user.getIdToken(true).then((token) => {
            request({
              url: url,
              encoding: null,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }, (error, resp, body) => {
              if (error) {
                reject(error)
              } else {
                fs.outputFile(path, body, (error) => {
                  if (error) {
                    reject(error)
                  } else {
                    resolve()
                  }
                })
              }
            })
          })
        } else {
          reject('Please login') // eslint-disable-line
        }
      })
    })
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
