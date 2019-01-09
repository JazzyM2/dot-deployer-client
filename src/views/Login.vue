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
import { createActualPath } from "../store/helpers";
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
    // this.enableAutoStart();
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.flashMessage("signing in...", "is-success");
        this.signIn();
      } else {
        this.authenticating = false;
      }
    });
  },
  methods: {
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
      let appPath = createActualPath(
        "$USERPROFILE\\AppData\\Local\\Programs\\Dot-Deployer\\Dot-Deployer.exe"
      );
      const DeployerAutoLaunch = new AutoLaunch({
        name: "Dot-Deployer",
        path: appPath
      });
      DeployerAutoLaunch.isEnabled().then(() => {
        DeployerAutoLaunch.enable();
      });
      // .catch(error => {
      //   console.error("Error Enabling AutoLaunch: ", error);
      // });
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
    createTokenListener() {
      // console.log("Token Listener Created...");
      ipcRenderer.on("tokens", (event, tokens) => {
        this.processSignIn(tokens);
      });
    },
    authenticate() {
      this.authenticating = true;
      this.createTokenListener();
      ipcRenderer.send("authenticate", {
        id: process.env.VUE_APP_CLIENTID,
        secret: process.env.VUE_APP_CLIENTSECRET
      });
    },
    processSignIn(tokens) {
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
      this.$store.dispatch("Deployer/githubListener");

      let github = this.$store.dispatch("Deployer/pullGitHub");
      let admins = this.$store.dispatch("Deployer/fireListener", {
        db: "admins",
        store: "setAdmins"
      });
      let installs = this.$store.dispatch("Deployer/fireListener", {
        db: "installs",
        store: "setInstalls"
      });
      let downloads = this.$store.dispatch("Deployer/fireListener", {
        db: "repositories",
        store: "setDownloads"
      });
      Promise.all([admins, installs, downloads, github]).then(
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
      this.$router.push("manage");
    }
  },
  computed: {
    repositories() {
      return this.$store.state.Deployer.repositories.repositories;
    },
    installs() {
      return this.$store.state.Deployer.installs;
    }
  }
};
</script>

<style lang="sass" scoped>
  section.login
    font-family: $font-stack
  button.login
    height: 24px
    margin-top: -100px
  img.logo
    height: 200px
    margin-top: -5px
  div.message
    margin-top: -40px
    background-color: $white
</style>
