import Vue from 'vue'

import App from './App'
import router from './router'
import store from './store'
import firebase from 'firebase'

import './firebase' // initiates firebase
import './store/filters' // registers global filters with vue

/* eslint-disable no-new */
new Vue({
  components: {
    App
  },
  router,
  store,
  template: '<App/>'
}).$mount('#app')

import Buefy from 'buefy'
import 'buefy/dist/buefy.css'

Vue.use(Buefy)

// authorization checker, redirects to login screen if user signs out
router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    return firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        next({
          path: '/',
          query: {
            redirect: to.fullPath
          }
        })
      } else {
        next()
      }
    })
  } else {
    next()
  }
})

const unsubsribe = firebase.auth().onAuthStateChanged((user) => {
  if (!user) {
    router.push('/')
  }
  unsubsribe()
})

import {
  Toast
} from 'buefy/dist/components/toast'

const {
  autoUpdater
} = require("electron-updater")

autoUpdater.on('checking-for-update', () => {
  Toast.open({
    message: "Checking for an update...",
    position: "is-bottom",
    type: "is-info"
  });
})

autoUpdater.on('update-available', () => {
  Toast.open({
    message: "Update Available!",
    position: "is-bottom",
    type: "is-success"
  });
})

autoUpdater.on('update-not-available', () => {
  Toast.open({
    message: "No Update Available",
    position: "is-bottom",
    type: "is-info"
  });
})

autoUpdater.on('error', (error) => {
  Toast.open({
    message: `Error: ${error}`,
    position: "is-bottom",
    type: "is-danger"
  });
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  Toast.open({
    message: log_message,
    position: "is-bottom",
    type: "is-info"
  });
})

autoUpdater.on('update-downloaded', () => {
  Toast.open({
    message: "Update Downloaded!",
    position: "is-bottom",
    type: "is-success"
  });
  // trigger app to close and update install
  // autoUpdater.quitAndInstall();
});
