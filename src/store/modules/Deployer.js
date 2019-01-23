import backend from '../backend'
import firebase from 'firebase'

import {
  ownerId,
  ownerName,
  createActualPath
} from "../../helpers.js";

const fs = require('fs-extra')
const requestPromise = require('request-promise')
const _ = require('lodash')

const baseURL = process.env.VUE_APP_APIURL

const state = {
  computerId: "",
  supports: ['3.0.0'],
  message: null,
  deploying: false,
  progress: null,
  modalActive: false,
  users: {},
  installs: {},
  repositories: {},
  metadata: {},
  releases: {}
}

const mutations = {
  setComputerId(state, computerId) {
    state.computerId = computerId
  },
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
  popMessage(state) {
    state.message = null
  },
  setRepositories(state, repositories) {
    state.repositories = repositories
  },
  setUsers(state, users) {
    state.users = users
  },
  setInstalls(state, installs) {
    state.installs = installs
  },
  setMetadata(state, metadata) {
    state.metadata = metadata
  },
  setReleases(state, payload) {
    state.releases[payload.name] = payload.releases
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
  fetchRepositoriesAndReleases: (context) => {
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
  repositoryListener: (context) => {
    return firebase.database().ref('installation_repositories').on('child_removed', () => {
      // fetch repositories from github, one or multiple have been added or removed
      // a cloud function will consume the github webhook payload for repo changes and mirror the database
      // for option to add custom metadata.  when child is deleted, the database has been successfully mirrored already
      context.dispatch('fetchRepositoriesAndReleases')
    })
  },
  releaseListener: (context) => {
    // this listener will trigger anytime data is removed from db.release
    // a github webhook pushes the github payload to the database, and a cloud function automatically removes it
    // this delete action will trigger the below listener
    return firebase.database().ref('release').on('child_removed', (snapshot) => {
      const snapshotData = snapshot.val()
      let repository = snapshotData.repository
      context.dispatch('releases', repository)
    });
  },
  updateInstall: (context, payload) => {
    return new Promise((resolve) => {
      createActualPath('$COMPUTERNAME').then(computerId => {
        let user = firebase.auth().currentUser.email
        let update = {}
        update[payload.id] = {}
        update[payload.id].tag = payload.tag
        firebase.database().ref(`installs/${computerId}`).update({
          user: user
        })
        firebase.database().ref(`installs/${computerId}/installs`).update(update).then(() => {
          resolve()
        })
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
  // addAdmin: (context, email) => {
  //   firebase.database().ref('admins').push({
  //     email: email
  //   })
  // },
  // deleteAdmin: (context, key) => {
  //   firebase.database().ref('admins/' + key).remove()
  // },
  // addRepo: (context, repo) => {
  //   return new Promise((resolve) => {
  //     let payload = _.cloneDeep(repo)
  //     payload.added_by = {}
  //     payload.added_by.email = firebase.auth().currentUser.email
  //     payload.added_by.photo = firebase.auth().currentUser.photoURL
  //     firebase.database().ref('repositories').push(payload)
  //     resolve()
  //   })
  // },
  // deleteRepo: (context, key) => {
  //   return new Promise((resolve) => {
  //     firebase.database().ref('repositories/' + key).remove()
  //     resolve()
  //   })
  // },
  repositories: (context) => {
    return new Promise((resolve, reject) => {
      backend.getRepositories().then(
        response => resolve(context.commit('setRepositories', response)),
        error => reject(error)
      )
    })
  },
  releases: (context, repository) => {
    const identity = ownerId(repository)
    const identityName = ownerName(repository)
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
      // add asset id to output path to ensure unique filename
      const encodedPath = `$TEMP\\${payload.id}-${payload.fileName}`
      createActualPath(encodedPath).then(path => {
        firebase.auth().onAuthStateChanged((user) => {
          user.getIdToken(true).then((token) => {
            const options = {
              method: 'GET',
              // resolveWithFullResponse: true,
              uri: `${baseURL}/asset?id=${payload.id}&repository=${payload.repository}`,
              // encoding: null,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
            requestPromise(options).then((asset) => {
              fs.remove(path).then(() => {
                fs.outputFile(path, asset, (error) => {
                  if (error) {
                    reject(error)
                  } else {
                    resolve(path)
                  }
                })
              })
            }).catch((error) => {
              reject(error)
            })
          })
        })
      })
    })
  },
  // getFileJSON: (context, payload) => {
  //   return new Promise((resolve, reject) => {
  //     const path = `${process.env.TEMP}\\${payload.name}.json`
  //     const url = `${baseURL}file?path=${payload.path}&repository=${payload.helpers.ownerName}`
  //     firebase.auth().onAuthStateChanged((user) => {
  //       if (user) {
  //         user.getIdToken(true).then((token) => {
  //           request({
  //             url: url,
  //             encoding: null,
  //             headers: {
  //               Authorization: `Bearer ${token}`
  //             }
  //           }, (error, resp, body) => {
  //             if (error) {
  //               reject(error)
  //             } else {
  //               // create the .deployer file for chosen repository
  //               fs.outputFile(path, body).then(() => {
  //                 // read file to create / verify json!
  //                 fs.readJson(path).then((deployerData) => {
  //                   context.commit('setDeployers', {
  //                     name: payload.helpers.ownerId,
  //                     deployer: deployerData
  //                   })
  //                   resolve()
  //                 }).catch(() => {
  //                   context.commit('setDeployers', {
  //                     name: payload.helpers.ownerId,
  //                     deployer: null
  //                   })
  //                   resolve()
  //                 })
  //               }).catch(() => {
  //                 reject(`Failed to write file to ${payload.path}`) // eslint-disable-line
  //               })
  //             }
  //           })
  //         })
  //       } else {
  //         reject('Please login') // eslint-disable-line
  //       }
  //     })
  //   })
  // },
  download: (context, payload) => {
    return new Promise((resolve, reject) => {
      const encodedPath = `$TEMP\\${payload.id}.zip`
      createActualPath(encodedPath).then(path => {
        firebase.auth().onAuthStateChanged((user) => {
          user.getIdToken(true).then((token) => {
            const options = {
              method: 'GET',
              uri: `${baseURL}/source?repository=${payload.repository}&tag=${payload.tag}`,
              encoding: null,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
            requestPromise(options).then((asset) => {
              fs.remove(path).then(() => {
                fs.outputFile(path, asset, (error) => {
                  if (error) {
                    reject(error)
                  } else {
                    resolve(path)
                  }
                })
              })
            }).catch((error) => {
              reject(error)
            })
          })
        })
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
