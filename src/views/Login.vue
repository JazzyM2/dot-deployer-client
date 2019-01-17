<template>
  <section class="login animated fadeIn">
    <div class="level login-logo">
      <div class="level-item has-text-centered">
        <img class="logo" src="@/assets/login.png" alt>
      </div>
    </div>
    <div class="level">
      <div class="level-item has-text-centered">
        <button
          onclick="this.blur()"
          :class="{'login': true, 'animated': true, 'fadeIn': true, 'button': true, 'is-small': true, 'is-dark': true, 'is-outlined': true, 'is-loading': authenticating}"
          @click="authenticate()"
        >Sign In with Google</button>
      </div>
    </div>
  </section>
</template>

<script>
import { createActualPath } from "../helpers.js";
const firebase = require("firebase");
const { ipcRenderer } = require("electron");
const psList = require("ps-list");
const childProcess = require("child_process");
const fs = require("fs-extra");
const AutoLaunch = require("auto-launch");
const _ = require("lodash");

export default {
  name: "Login",
  data() {
    return {
      authenticating: true
    };
  },
  mounted() {
    this.enableAutoStart();
    process.env.NODE_ENV === "production"
      ? this.checkForUpdates()
      : this.firebaseAuthListener();
  },
  methods: {
    checkForUpdates() {
      ipcRenderer.send("check-for-updates", "payload");
      ipcRenderer.on("auto-updater-message", (event, payload) => {
        this.flashMessage(payload.message, payload.type);
      });
      ipcRenderer.on("update-not-available", () => {
        this.firebaseAuthListener();
      });
    },
    firebaseAuthListener() {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          this.flashMessage("signing in...", "is-light");
          this.signIn();
        } else {
          this.authenticating = false;
        }
      });
    },
    checkForProcessesOpen(process) {
      return new Promise(resolve => {
        psList().then(data => {
          _.forEach(data, p => {
            if (p.name === process) {
              let processId = p.pid;
              resolve(processId);
            }
          });
          resolve(null);
        });
      });
    },
    enableAutoStart() {
      // app path will be automatically detected by auto launch
      const DeployerAutoLaunch = new AutoLaunch({
        name: "Dot Deployer"
      });
      DeployerAutoLaunch.isEnabled().then(isEnabled => {
        if (!isEnabled) {
          DeployerAutoLaunch.enable();
        }
      });
    },
    uninstallAppManager() {
      return new Promise((resolve, reject) => {
        let uninstallPath = createActualPath(
          "$USERPROFILE\\AppData\\Local\\WeWork\\Update.exe"
        );
        let isUninstalledPath = createActualPath(
          "$USERPROFILE\\AppData\\Local\\WeWork\\.dead"
        );
        fs.pathExists(uninstallPath).then(appManExists => {
          if (appManExists) {
            fs.pathExists(isUninstalledPath).then(isUninstalled => {
              if (!isUninstalled) {
                this.checkForProcessesOpen("WeWork.AppManager.exe").then(
                  processId => {
                    if (processId) {
                      // close the process
                      process.kill(processId);
                    }
                    childProcess.execFile(
                      uninstallPath,
                      ["--uninstall"],
                      error => {
                        if (error) {
                          reject(error);
                        } else {
                          resolve("Successfully Uninstalled Legacy App Man!");
                        }
                      }
                    );
                  }
                );
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      });
    },
    authenticate() {
      this.authenticating = true;
      ipcRenderer.send("authenticate", {
        id: process.env.VUE_APP_CLIENTID,
        secret: process.env.VUE_APP_CLIENTSECRET
      });
      ipcRenderer.on("tokens", (event, tokens) => {
        this.signInWithTokens(tokens);
      });
    },
    signInWithTokens(tokens) {
      var credential = firebase.auth.GoogleAuthProvider.credential(
        tokens.id_token,
        tokens.access_token
      );
      firebase.auth().signInAndRetrieveDataWithCredential(credential);
    },
    flashMessage(message, type) {
      this.$toast.open({
        message: message,
        position: "is-bottom",
        type: type
      });
    },
    signIn() {
      // this.$store.dispatch("Deployer/updateRollbarConfig", user);
      this.$store.dispatch("Deployer/releaseListener");
      this.$store.dispatch("Deployer/repositoryListener");

      let fetchGitHub = this.$store.dispatch(
        "Deployer/fetchRepositoriesAndReleases"
      );
      let users = this.$store.dispatch("Deployer/fireListener", {
        db: "users",
        store: "setUsers"
      });
      let installs = this.$store.dispatch("Deployer/fireListener", {
        db: "installs",
        store: "setInstalls"
      });
      let metadata = this.$store.dispatch("Deployer/fireListener", {
        db: "repositories",
        store: "setMetadata"
      });
      Promise.all([users, installs, metadata, fetchGitHub]).then(
        () => this.handleSignInSuccess(),
        error => this.handleSignInFailure(error)
      );
    },
    handleSignInFailure(error) {
      firebase.auth().signOut();
      this.authenticating = false;
      let message = "";
      try {
        message = error.response.data.message;
      } catch (err) {
        message = error;
      }
      this.flashMessage(message, "is-danger");
    },
    handleSignInSuccess() {
      this.uninstallAppManager()
        .then(result => {
          if (result) {
            this.flashMessage(result, "is-success");
          }
          this.continue();
        })
        .catch(error => {
          this.flashMessage(error, "is-danger");
          this.continue();
        });
    },
    continue() {
      this.authenticating = false;
      this.$router.push("install");
    }
  }
};
</script>

<style lang="sass" scoped>
  section.login
    font-family: $font-stack
  button.login
    height: 24px
    margin-top: -95px
  img.logo
    height: 200px
    margin-top: -5px
</style>
