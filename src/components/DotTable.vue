<template>
  <div>
    <table class="table is-narrow is-striped is-hoverable is-fullwidth animated fadeIn">
      <tbody v-for="(repository, index) in source" :key="index">
        <tr>
          <td @click="toggleRepoInsights(repository)" class="insights">
            <span class="icon">
              <i
                v-if="repoToggles[repository.id] == true"
                class="expand fa fa-caret-up"
                aria-hidden="true"
                @click="toggleRepoInsights(repository)"
              ></i>
              <i
                v-else
                class="expand fa fa-caret-down"
                aria-hidden="true"
                @click="toggleRepoInsights(repository)"
              ></i>
            </span>
          </td>
          <td @click="toggleRepoInsights(repository)" class="tool">
            <p class="download-title">{{ getRepositoryName(repository) | chopString(30) }}</p>
          </td>
          <td @click="toggleRepoInsights(repository)" class="description">
            <p class="download-description">{{ repository.description | chopString(50) }}</p>
          </td>
          <td class="version">
            <button
              v-if="isInstalled(repository)"
              :class="{'is-static': true, 'button': true, 'animated': true, 'fadeIn': true, 'is-outlined': true, 'is-rounded': true, 'is-small': true, 'is-warning': isInstalledPreRelease(repository), 'is-primary': !isInstalledPreRelease(repository)}"
            >{{ getInstalledTag(repository) }}</button>
          </td>
          <td class="action">
            <dropdown
              class="dropdown"
              title="Install"
              :update="isUpdateAvailable(repository, false)"
              :repository="repository"
              :tag="getInstalledTag(repository)"
              @change-event="downloadAndProcess($event, repository, true)"
            ></dropdown>
          </td>
          <td class="action">
            <button
              v-if="isInstalled(repository)"
              @click="downloadAndProcess(getInstalledTag(repository), repository, false)"
              class="animated uninstall fadeIn button is-outlined is-rounded is-small is-info"
            >Uninstall</button>
          </td>
        </tr>
        <tr v-if="repoToggles[repository.id] == true" class="animated fadeIn">
          <td></td>
          <td>
            <b-tooltip
              v-if="isAdmin"
              :active="formInput.hasOwnProperty(repository.id)"
              size="is-small"
              label="Press Enter To Update"
              position="is-bottom"
              type="is-white"
            >
              <input
                class="input is-info is-small"
                :placeholder="getRepositoryName(repository)"
                v-model="formInput[repository.id]"
                @keyup.enter="editRepoName(repository)"
              >
            </b-tooltip>
          </td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import Dropdown from "./Dropdown";

import {
  ownerId,
  ownerName,
  createActualPath,
  flattenObject
} from "../helpers.js";

const _ = require("lodash");
const fs = require("fs-extra");
const DecompressZip = require("decompress-zip");
const firebase = require("firebase");
const psList = require("ps-list");
const { shell } = require("electron");

export default {
  name: "DotTable",
  data() {
    return {
      confirm: false,
      repoToggles: {},
      formInput: {}
    };
  },
  components: {
    dropdown: Dropdown
  },
  mounted() {
    this.checkForUpdates();
  },
  props: ["source", "admin"],
  methods: {
    getRepositoryName(repository) {
      let metadata = _.find(this.metadata, obj => {
        return obj.id == repository.id;
      });
      if (metadata) {
        return metadata.name; // metadata automatically piped with github name on creation
      } else {
        return repository.name;
      }
    },
    editRepoName(repository) {
      let payload = {};
      let metadata = _.find(this.metadata, obj => {
        return obj.id == repository.id;
      });
      payload.key = metadata.key;
      payload.name = this.formInput[repository.id];
      // make sure user has entered something
      if (payload.name) {
        this.$store
          .dispatch("Deployer/updateRepoName", payload)
          .then(() => {
            delete this.formInput[repository.id];
            this.$forceUpdate();
          })
          .catch(error => {
            this.flashMessage(error, true);
          });
      }
    },
    checkForUpdates() {
      _.forEach(this.source, repository => {
        if (this.isUpdateAvailable(repository, true)) {
          let identity = ownerId(repository);
          let releases = this.releases[identity];
          let latestReleaseTag = this.getLatestReleaseTag(releases);
          // TODO add a "then continue" after each promise to make multiple installs sequential?
          this.downloadAndProcess(latestReleaseTag, repository, true);
        }
      });
    },
    getIndexOfTag(releases, releaseTag) {
      let foundRelease = _.find(releases, { tag_name: releaseTag });
      return releases.indexOf(foundRelease);
    },
    getLatestReleaseTag(releases) {
      let latestTag = _.find(releases, { prerelease: false });
      return latestTag ? latestTag.tag_name : null;
    },
    getInstalledTag(download) {
      if (this.isInstalled(download)) {
        return this.installs[this.computerId].installs[download.id].tag;
      }
    },
    isUpdateAvailable(download, releaseOnly) {
      // only return true for releases that are more current than installed!!
      let identity = ownerId(download);
      let releases = this.releases[identity];
      if (!releases) {
        return false;
      }
      if (releases.length > 0) {
        let installedTag = this.getInstalledTag(download);
        let latestTag = "";
        releaseOnly == true
          ? (latestTag = this.getLatestReleaseTag(releases))
          : (latestTag = releases[0].tag_name);
        if (!installedTag || !latestTag) {
          return false; // do not try to update
        }
        let indexOfInstalled = this.getIndexOfTag(releases, installedTag);
        let indexOfLatest = this.getIndexOfTag(releases, latestTag);
        if (indexOfInstalled === -1) {
          // install is no longer present in releases, update!
          return true;
        } else if (indexOfInstalled > indexOfLatest) {
          // an update is available!
          return true;
        } else {
          // no update available
          return false;
        }
      } else {
        return false;
      }
    },
    toggleRepoInsights(repository) {
      let currentToggleSetting = this.repoToggles[repository.id];
      if (!currentToggleSetting) {
        this.repoToggles[repository.id] = true;
      } else {
        this.repoToggles[repository.id] = !currentToggleSetting;
      }
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },
    checkForProcessesOpen(processes) {
      return new Promise((resolve, reject) => {
        if (!processes || processes.length === 0) {
          resolve();
        }
        psList().then(data => {
          _.forEach(processes, program => {
            _.forEach(data, p => {
              if (p.name === program.name) {
                reject(`Please close ${program.name} and try again!`); // eslint-disable-line
              }
            });
          });
          resolve();
        });
      });
    },
    isInstalledPreRelease(repository) {
      let identity = ownerId(repository);
      let tagName = this.getInstalledTag(repository);
      let installed = _.find(this.releases[identity], { tag_name: tagName });
      if (installed) {
        return installed.prerelease;
      } else {
        return null;
      }
    },
    stopDeploying() {
      this.$store.dispatch("Deployer/setDeploying", false);
      this.$store.dispatch("Deployer/setProgress", null);
    },
    createAssetPayload(repository, release, asset) {
      let assetId = asset.id;
      let releaseId = release.id;
      let fileName = asset.name;
      let identity = ownerName(repository);
      return {
        releaseId: releaseId,
        assetId: assetId,
        fileName: fileName,
        repository: identity
      };
    },
    createSourcePayload(repository, release) {
      let id = release.id;
      let tag = release.tag_name;
      let identity = ownerName(repository);
      return { id: id, tag: tag, repository: identity };
    },
    hasDependencies(dependsOn) {
      return new Promise((resolve, reject) => {
        if (!dependsOn) {
          resolve();
        }
        let itemsProcessed = 0;
        _.forEach(dependsOn, tool => {
          itemsProcessed = itemsProcessed + 1;
          if (!this.isInstalled(tool)) {
            reject(`Please install ${tool.name} first!`); // eslint-disable-line
          }
          if (itemsProcessed === dependsOn.length) {
            resolve();
          }
        });
      });
    },
    supportsSchema(version) {
      // checks if .deployer schema is supported by this client
      // define supported versions in Deployer.js
      return new Promise((resolve, reject) => {
        let supports = this.$store.state.Deployer.supports;
        if (supports.indexOf(version) === -1) {
          reject(`${version} schema is not supported by this client!`); // eslint-disable-line
        }
        resolve();
      });
    },
    processUninstall(uninstall, parentPath) {
      return new Promise(resolve => {
        if (!uninstall) {
          resolve();
        } else {
          _.forEach(uninstall, operation => {
            if (operation.action === "run") {
              createActualPath(`${parentPath}\\${operation.source}`).then(
                path => {
                  shell.openItem(path);
                }
              );
            } else if (operation.action === "delete") {
              createActualPath(operation.source).then(path => {
                fs.removeSync(path);
              });
            }
          });
          resolve();
        }
      });
    },
    installOperation(operation, parentPath) {
      return new Promise((resolve, reject) => {
        let fileName = operation.source;
        let tempFilePath = `${parentPath}\\${fileName}`;
        if (operation.action === "copy") {
          createActualPath(operation.destination).then(decodedPath => {
            let destFilePath = `${decodedPath}\\${fileName}`;
            // copy file to destination
            console.log(`copying from ${tempFilePath} to ${destFilePath}`);
            fs.copy(tempFilePath, destFilePath)
              .then(() => {
                let extension = this.getExtension(fileName);
                if (
                  extension === "zip" ||
                  extension === "tar" ||
                  extension === "gz"
                ) {
                  // initiate unzipper event listeners
                  const unzipper = new DecompressZip(destFilePath);
                  unzipper.on("error", error => {
                    reject(error);
                  });
                  unzipper.on("extract", () => {
                    fs.remove(destFilePath).then(() => {
                      resolve();
                    });
                  });
                  // extract contents
                  unzipper.extract({ path: decodedPath });
                } else {
                  resolve();
                }
              })
              .catch(error => {
                reject(error);
              });
          });
        } else if (operation.action === "run") {
          shell.openItem(tempFilePath);
          resolve();
        }
      });
    },
    processInstall(deploy, parentPath) {
      return new Promise((resolve, reject) => {
        let installProcesses = [];
        _.forEach(deploy.install, operation => {
          installProcesses.push(this.installOperation(operation, parentPath));
        });
        Promise.all(installProcesses)
          .then(() => {
            resolve();
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    download(repository, release) {
      return new Promise((resolve, reject) => {
        const assets = release.assets;
        if (assets.length > 0) {
          // download all custom assets in a release
          let downloads = [];
          _.forEach(assets, asset => {
            downloads.push(
              this.$store.dispatch(
                "Deployer/asset",
                this.createAssetPayload(repository, release, asset)
              )
            );
          });
          Promise.all(downloads)
            .then(paths => {
              resolve(paths[0]);
            })
            .catch(error => {
              reject(error);
            });
        } else {
          // download source code of a release
          this.$store
            .dispatch(
              "Deployer/download",
              this.createSourcePayload(repository, release)
            )
            .then(path => {
              resolve(path);
            })
            .catch(error => {
              reject(error);
            });
        }
      });
    },
    downloadAndProcess(tag, repository, installBool) {
      // launch loading screen
      this.$store.dispatch("Deployer/setDeploying", true);
      let release = _.find(this.releases[ownerId(repository)], {
        tag_name: tag
      });
      this.$store.dispatch("Deployer/setProgress", {
        tool: this.getRepositoryName(repository),
        title: `Downloading Release...`,
        value: 10
      });
      this.download(repository, release)
        .then(parentPath => {
          fs.readdir(parentPath, (err, files) => {
            let deployerFile = _.find(files, file => {
              return file.includes(".deployer");
            });
            if (deployerFile) {
              fs.readJson(`${parentPath}\\${deployerFile}`)
                .then(deployerData => {
                  this.$store.dispatch("Deployer/setProgress", {
                    tool: this.getRepositoryName(repository),
                    title: `Validating Deployer Configuration...`,
                    value: 20
                  });
                  console.log("Deployer Data: ", deployerData);
                  this.$store
                    .dispatch("Deployer/validate", deployerData)
                    .then(() => {
                      this.$store.dispatch("Deployer/setProgress", {
                        tool: this.getRepositoryName(repository),
                        title: `Checking Schemas and Dependencies...`,
                        value: 30
                      });
                      this.supportsSchema(deployerData.version)
                        .then(() => {
                          this.hasDependencies(deployerData.dependson)
                            .then(() => {
                              this.$store.dispatch("Deployer/setProgress", {
                                tool: this.getRepositoryName(repository),
                                title: `Checking For Open Processes...`,
                                value: 40
                              });
                              this.checkForProcessesOpen(deployerData.processes)
                                .then(() => {
                                  this.$store.dispatch("Deployer/setProgress", {
                                    tool: this.getRepositoryName(repository),
                                    title: `Uninstalling Old Files...`,
                                    value: 60
                                  });
                                  this.processUninstall(
                                    deployerData.uninstall,
                                    parentPath
                                  )
                                    .then(() => {
                                      if (installBool) {
                                        this.$store.dispatch(
                                          "Deployer/setProgress",
                                          {
                                            tool: this.getRepositoryName(
                                              repository
                                            ),
                                            title: `Installing Files...`,
                                            value: 80
                                          }
                                        );
                                        this.processInstall(
                                          deployerData,
                                          parentPath
                                        )
                                          .then(() => {
                                            this.handleSuccessfulInstall(
                                              repository,
                                              release.tag_name
                                            );
                                          })
                                          .catch(error => {
                                            this.handleInstallError(error);
                                          });
                                      } else {
                                        this.handleSuccessfulUninstall(
                                          repository,
                                          release.tag_name
                                        );
                                      }
                                    })
                                    .catch(error => {
                                      this.handleInstallError(error);
                                    });
                                })
                                .catch(error => {
                                  this.handleInstallError(error);
                                });
                            })
                            .catch(error => {
                              this.handleInstallError(error);
                            });
                        })
                        .catch(() => {
                          this.handleInstallError(
                            `This client does not support installing version ${
                              deployerData.version
                            } .deployer configurations`
                          );
                        });
                    })
                    .catch(error => {
                      this.handleInstallError(error);
                    });
                })
                .catch(error => {
                  this.handleInstallError(error);
                });
            } else {
              this.handleInstallError(
                "No .deployer file found in this release!"
              );
            }
          });
        })
        .catch(error => {
          this.handleInstallError(error);
        });
    },
    isInstalled(download) {
      try {
        return this.installs[this.computerId].installs[download.id].tag;
      } catch (error) {
        return false; // eslint-disable-line
      }
    },
    flashMessage(message, error) {
      console.log("Flashing Message: ", message);
      let type;
      let newMessage;
      error == true ? (type = "is-danger") : (type = "is-success");
      message.message == null
        ? (newMessage = message.toString())
        : (newMessage = message.message.toString());
      this.$toast.open({
        message: newMessage,
        position: "is-bottom",
        type: type,
        duration: 2500
      });
    },
    getExtension(asset) {
      let substringArray = asset.split(".");
      return substringArray[substringArray.length - 1];
    },
    handleSuccessfulUninstall(repository, tag) {
      this.$store.dispatch("Deployer/removeInstall", repository.id).then(() => {
        this.stopDeploying();
        this.flashMessage(
          `Successfully Uninstalled ${this.getRepositoryName(
            repository
          )} ${tag}`,
          false
        );
      });
    },
    handleSuccessfulInstall(repository, tag) {
      this.$store.dispatch("Deployer/setProgress", {
        tool: this.getRepositoryName(repository),
        title: `Successfully Installed!`,
        value: 100
      });
      this.$store
        .dispatch("Deployer/updateInstall", { id: repository.id, tag: tag })
        .then(() => {
          this.stopDeploying();
          this.flashMessage(
            `Successfully installed: ${this.getRepositoryName(
              repository
            )} ${tag}`,
            false
          );
        });
    },
    handleInstallError(error) {
      this.stopDeploying();
      this.flashMessage(error, true);
    }
  },
  computed: {
    computerId() {
      return this.$store.state.Deployer.computerId;
    },
    installs() {
      return this.$store.state.Deployer.installs;
    },
    releases() {
      return this.$store.state.Deployer.releases;
    },
    githubTrigger() {
      return this.$store.state.Deployer.githubTrigger;
    },
    users() {
      return this.$store.state.Deployer.users;
    },
    metadata() {
      return flattenObject(this.$store.state.Deployer.metadata);
    },
    userEmail() {
      let user = firebase.auth().currentUser;
      return user ? firebase.auth().currentUser.email : null;
    },
    isAdmin() {
      let user = _.find(this.users, { email: this.userEmail });
      if (user != null) {
        return user.role == "admin";
      } else {
        return false;
      }
    }
  },
  watch: {
    githubTrigger: function() {
      console.log("Checking for updates...");
      this.checkForUpdates();
    }
  }
};
</script>

<style lang="sass" scoped>
  td.insights
    width: 20px
    cursor: pointer
  td.tool
    width: 220px
    cursor: pointer
  td.description
    cursor: pointer
  //   width: 250px
  // td.version
  //   width: 40px
  // td.action:not(:last-child)
  //   padding-left: 4px
  //   padding-right: 4px
  // button.is-rounded
  //   height: 18px
  // button.uninstall
  //   margin-left: 8px
  i.expand
    color: $info
    cursor: pointer
  i.yellow
    color: $yellow
  i.red
    color: $danger
  span.icon.admin
    cursor: pointer
  table
    font-size: 14px
  .download-title
    font-size: 13px
    font-weight: bold
  .download-description
    font-size: 12px
    color: lighten($dark, 50)
</style>
