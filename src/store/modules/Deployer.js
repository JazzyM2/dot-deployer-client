import backend from '../backend'
import firebase from 'firebase'

import {
  ownerId,
  ownerName,
  createActualPath
} from "../../helpers.js";

const _ = require('lodash')
const fs = require('fs-extra')
const DecompressZip = require("decompress-zip");

const state = {
  computerId: "",
  supports: ['3.0.0'],
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
  setDeploying(state, bool) {
    state.deploying = bool
  },
  setProgress(state, payload) {
    state.progress = payload
  },
  setModalActive(state, bool) {
    state.modalActive = bool
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
      console.log('Relase Listener Triggered...', snapshotData)
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
      let computerId = context.state.computerId
      firebase.database().ref(`installs/${computerId}/installs/${repo}`).remove()
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
  asset: (context, payload) => {
    return new Promise((resolve, reject) => {
      backend.getAsset(payload.repository, payload.assetId).then(asset => {
        const encodedPath = `$TEMP\\${payload.repository.replace('/', '-')}-${payload.releaseId}`
        createActualPath(encodedPath).then(parentPath => {
          let filePath = `${parentPath}\\${payload.fileName}`
          fs.remove(filePath).then(() => {
            fs.outputFile(filePath, asset, (outputError) => {
              if (outputError) {
                reject(outputError)
              } else {
                resolve(parentPath)
              }
            })
          }).catch((error) => {
            reject(error)
          })
        }).catch((error) => {
          reject(error)
        })
      }).catch((error) => {
        reject(error)
      })
    })
  },
  download: (context, payload) => {
    return new Promise((resolve, reject) => {
      backend.getSource(payload.repository, payload.tag).then(download => {
        const encodedPath = `$TEMP\\${payload.id}.zip`
        createActualPath(encodedPath).then(path => {
          fs.outputFile(path, download, (outputError) => {
            if (outputError) {
              reject(outputError)
            } else {
              const unzipper = new DecompressZip(path);
              unzipper.on("error", error => {
                reject(error);
              });
              unzipper.on("extract", log => {
                // remove original .zip file from temp folder
                fs.remove(path)
                  .then(() => {
                    // this folder will be unique, it has commit hash in it
                    let parentFolder = log[0].folder;
                    let encodedPath = `$TEMP\\${parentFolder}`;
                    createActualPath(encodedPath).then(extractedPath => {
                      resolve(extractedPath);
                    });
                  })
                  .catch(error => {
                    reject(error);
                  });
              });
              createActualPath("$TEMP").then(tempPath => {
                unzipper.extract({
                  path: tempPath
                });
              });
            }
          })
        }).catch((error) => {
          reject(error)
        })
      })
    })
  }
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
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
