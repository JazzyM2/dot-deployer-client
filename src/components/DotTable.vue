<template>
  <div>
    <modal
      v-if="confirm"
      title="Tool Release"
      :message="modalMessage"
      @yes="toggleRelease()"
      @close="cancel()"
    ></modal>
    <table class="table is-narrow is-striped is-hoverable is-fullwidth animated fadeIn">
      <tbody>
        <tr v-for="(download, index) in source" :key="index">
          <td class="insights">
            <span class="icon">
              <i class="expand fa fa-info" aria-hidden="true" @click="launchModal(download)"></i>
            </span>
          </td>
          <td class="tool">
            <p class="download-title">{{ download.name | chopString(30) | capitalize }}</p>
          </td>
          <td class="description">
            <p class="download-description">{{ download.description }}</p>
          </td>
          <td class="version">
            <button
              v-if="isInstalled(download)"
              :class="{'is-static': true, 'button': true, 'animated': true, 'fadeIn': true, 'is-outlined': true, 'is-rounded': true, 'is-small': true, 'is-warning': isInstalledPreRelease(download), 'is-primary': !isInstalledPreRelease(download)}"
            >{{ getInstalledTag(download) }}</button>
          </td>
          <td class="action">
            <dropdown
              class="dropdown"
              title="Install"
              :update="isAnyUpdatePresent(download)"
              :menu="generateDropdownMenu(download)"
              :tag="getInstalledTag(download)"
              @change-event="downloadTag($event, download)"
            ></dropdown>
          </td>
          <td class="action">
            <button
              v-if="isInstalled(download)"
              @click="uninstall(download)"
              class="animated uninstall fadeIn button is-outlined is-rounded is-small is-info"
            >Uninstall</button>
          </td>
          <td v-if="admin" class="admin">
            <button
              v-if="!isAvailable(download)"
              onclick="this.blur()"
              @click="confirmReleaseToggle(download)"
              class="button is-outlined is-small is-rounded"
            >
              <i class="fa fa-rocket yellow"></i>
            </button>
            <button
              v-else
              onclick="this.blur()"
              @click="confirmReleaseToggle(download)"
              class="button is-outlined is-small is-rounded"
            >
              <i class="fa fa-trash red"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import Dropdown from "./Dropdown";
import Modal from "./Modal";

import { ownerId, ownerName, createActualPath } from "../helpers.js";

const _ = require("lodash");
const fs = require("fs-extra");
const DecompressZip = require("decompress-zip");
const psList = require("ps-list");
const { shell } = require("electron");

export default {
  name: "DotTable",
  data() {
    return {
      confirm: false,
      modalMessage: null
    };
  },
  components: {
    dropdown: Dropdown,
    modal: Modal
  },
  mounted() {
    // this.checkForUpdates();
  },
  props: ["source", "admin"],
  methods: {
    confirmReleaseToggle(repository) {
      // launches confirmation modal
      this.$store.dispatch("Deployer/setDownloadSelected", repository);
      let download = this.isAvailable(this.downloadSelected);
      if (download) {
        this.modalMessage = `Are you sure you want to remove ${
          this.downloadSelected.name
        } from available tools?`;
      } else {
        this.modalMessage = `Are you sure you want to release ${
          this.downloadSelected.name
        } to all users?`;
      }
      this.confirm = true;
    },
    cancel() {
      this.$store.dispatch("Deployer/setDownloadSelected", null);
      this.confirm = false;
    },
    toggleRelease() {
      let download = this.isAvailable(this.downloadSelected);
      if (download) {
        this.$store.dispatch("Deployer/deleteRepo", download.key);
      } else {
        this.$store.dispatch("Deployer/addRepo", this.downloadSelected);
      }
      this.confirm = false;
    },
    checkForUpdates() {
      console.log("Checking for updates...");
      _.forEach(this.source, download => {
        if (this.isUpdateAvailable(download)) {
          this.deployerDataExists(download)
            .then(deployData => {
              if (deployData.autoupdate) {
                this.downloadUpdate(download);
              }
            })
            .catch(error => {
              this.flashMessage(error, true);
            });
        }
      });
    },
    getIndexOfTag(releases, releaseTag) {
      let foundRelease = _.find(releases, { tag_name: releaseTag });
      return releases.indexOf(foundRelease);
    },
    getLatestReleaseTag(releases) {
      let latestTag = _.find(releases, { prerelease: false });
      if (latestTag) {
        return latestTag.tag_name;
      } else {
        return latestTag;
      }
    },
    getInstalledTag(download) {
      if (this.isInstalled(download)) {
        return this.installs[this.computerName].installs[download.id].tag;
      }
    },
    isAnyUpdatePresent(download) {
      let identity = ownerId(download);
      let releases = this.releases[identity];
      if (releases.length > 0) {
        let installedTag = this.getInstalledTag(download);
        let latestTag = releases[0].tag_name;
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
    isUpdateAvailable(download) {
      // only return true for releases that are more current than installed!!
      let identity = ownerId(download);
      let releases = this.releases[identity];
      if (releases.length > 0) {
        let installedTag = this.getInstalledTag(download);
        let latestTag = this.getLatestReleaseTag(releases);
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
    downloadUpdate(download) {
      let identity = ownerId(download);
      let releases = this.releases[identity];
      let latestRelease = this.getLatestReleaseTag(releases);
      if (latestRelease) {
        this.downloadTag(latestRelease, download);
      }
    },
    launchModal(repository) {
      this.$store.dispatch("Deployer/setModalActive", true);
      this.$store.dispatch("Deployer/setDownloadSelected", repository);
    },
    isAvailable(repository) {
      return _.find(this.downloads, { id: repository.id });
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
    uninstall(download) {
      this.$store.dispatch("Deployer/setDeploying", true);
      this.deployerDataExists(download)
        .then(deploy => {
          this.supportsSchema(deploy.version)
            .then(() => {
              // validate deployer data
              this.$store.dispatch("Deployer/setProgress", {
                tool: download.name,
                title: `Validating .deployer data...`,
                value: 0
              });
              this.$store
                .dispatch("Deployer/validate", deploy)
                .then(() => {
                  // check for open processes
                  this.$store.dispatch("Deployer/setProgress", {
                    tool: download.name,
                    title: `Checking for open processes...`,
                    value: 33
                  });
                  this.checkForProcessesOpen(deploy.processes)
                    .then(() => {
                      // uninstall current install
                      this.$store.dispatch("Deployer/setProgress", {
                        tool: download.name,
                        title: `Uninstalling current files...`,
                        value: 66
                      });
                      this.processUninstall(deploy.uninstall)
                        .then(() => {
                          this.$store
                            .dispatch("Deployer/removeInstall", download.name)
                            .then(() => {
                              this.stopDeploying();
                              this.flashMessage(
                                `Successfully Uninstalled ${download.name}`,
                                false
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
                })
                .catch(error => {
                  this.handleAPIError(error);
                });
            })
            .catch(error => {
              this.handleInstallError(error);
            });
        })
        .catch(error => {
          this.handleInstallError(error);
        });
    },
    stopDeploying() {
      this.$store.dispatch("Deployer/setDeploying", false);
      this.$store.dispatch("Deployer/setProgress", null);
    },
    createAssetPayload(repository, asset) {
      let id = asset.id;
      let identity = ownerName(repository);
      return { name: asset.name, id: id, repository: identity };
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
    deployerDataExists() {
      // checks if .deployer data exists and is valid JSON
      return new Promise(resolve => {
        resolve(true);
      });
    },
    processUninstall(uninstall) {
      return new Promise((resolve, reject) => {
        if (!uninstall) {
          resolve();
        } else {
          let uninstallers = [];
          _.forEach(uninstall, operation => {
            let path = createActualPath(operation.source);
            if (operation.action === "run") {
              shell.openItem(path);
            } else if (operation.action === "delete") {
              uninstallers.push(fs.remove(path));
            }
          });
          Promise.all(uninstallers)
            .then(() => {
              resolve();
            })
            .catch(error => {
              reject(error);
            });
        }
      });
    },
    processDownload(deploy, download, release) {
      return new Promise((resolve, reject) => {
        if (deploy.assets) {
          // check that custom assets exist in release
          let assets = release.assets;
          if (assets.length === 0 || !assets) {
            reject(
              `No assets available in ${download.name} ${release.tag_name}`
            ); // eslint-disable-line
          } else {
            // download all custom assets -- actions for file(s) defined in .deployer
            let downloads = [];
            _.forEach(assets, asset => {
              downloads.push(
                this.$store.dispatch(
                  "Deployer/asset",
                  this.createAssetPayload(download, asset)
                )
              );
            });
            Promise.all(downloads)
              .then(() => {
                resolve(process.env.TEMP);
              })
              .catch(error => {
                reject(error);
              });
          }
        } else {
          // download zip of source code in tag and extract -- actions for file(s) defined in .deployer
          this.$store
            .dispatch("Deployer/download", {
              url: release.zipball_url,
              name: download.name
            })
            .then(() => {
              let tempFolder = process.env.TEMP;
              let tempFilePath = `${tempFolder}\\${download.name}.zip`;
              let unzipper = new DecompressZip(tempFilePath);
              unzipper.on("error", error => {
                reject(error);
              });
              unzipper.on("extract", log => {
                // this folder will be unique, it has commit hash in it
                let parentFolder = log[0].folder;
                let parentPath = `${tempFolder}\\${parentFolder}`;
                resolve(parentPath);
              });
              unzipper.extract({ path: tempFolder });
            })
            .catch(error => {
              reject(error);
            });
        }
      });
    },
    installOperation(operation, assets, parentPath) {
      return new Promise((resolve, reject) => {
        let fileName = operation.source;
        let tempFilePath = `${parentPath}\\${fileName}`;
        if (operation.action === "copy") {
          let destination = createActualPath(operation.destination);
          let destFilePath = `${destination}\\${fileName}`;
          // copy file to destination
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
                unzipper.extract({ path: `${destination}` });
              } else {
                resolve();
              }
            })
            .catch(error => {
              reject(error);
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
          installProcesses.push(
            this.installOperation(operation, deploy.assets, parentPath)
          );
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
    downloadTag(tag, download) {
      // launch loading screen
      this.$store.dispatch("Deployer/setDeploying", true);
      let release = _.find(this.releases[ownerId(download)], {
        tag_name: tag
      });
      // fetch deployer data for install and check schema and dependencies
      this.deployerDataExists(download)
        .then(deploy => {
          this.supportsSchema(deploy.version)
            .then(() => {
              this.hasDependencies(deploy.dependson)
                .then(() => {
                  // validate deployer data
                  this.$store.dispatch("Deployer/setProgress", {
                    tool: download.name,
                    title: `Validating .deployer data...`,
                    value: 0
                  });
                  this.$store
                    .dispatch("Deployer/validate", deploy)
                    .then(() => {
                      // check for open processes
                      this.$store.dispatch("Deployer/setProgress", {
                        tool: download.name,
                        title: `Checking for open processes...`,
                        value: 20
                      });
                      this.checkForProcessesOpen(deploy.processes)
                        .then(() => {
                          // uninstall current install
                          this.$store.dispatch("Deployer/setProgress", {
                            tool: download.name,
                            title: `Uninstalling current files...`,
                            value: 40
                          });
                          this.processUninstall(deploy.uninstall)
                            .then(() => {
                              // download files in repo (either zipball of contents or all assets)
                              this.$store.dispatch("Deployer/setProgress", {
                                tool: download.name,
                                title: `Downloading files...`,
                                value: 60
                              });
                              this.processDownload(deploy, download, release)
                                .then(parentPath => {
                                  // install files
                                  this.$store.dispatch("Deployer/setProgress", {
                                    tool: download.name,
                                    title: `Installing files...`,
                                    value: 80
                                  });
                                  this.processInstall(deploy, parentPath)
                                    .then(() => {
                                      this.handleSuccessfulInstall(
                                        download,
                                        tag
                                      );
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
                        .catch(error => {
                          this.handleInstallError(error);
                        });
                    })
                    .catch(error => {
                      this.handleAPIError(error);
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
        .catch(error => {
          this.handleInstallError(error);
        });
    },
    isInstalled(download) {
      try {
        return this.installs[this.computerName].installs[download.id].tag;
      } catch (error) {
        return false; // eslint-disable-line
      }
    },
    generateDropdownMenu(download) {
      let menu = [];
      _.forEach(this.releases[ownerId(download)], release => {
        let tag = release.tag_name;
        let description = release.body;
        let id = release.id;
        let prerelease = release.prerelease;
        let title = release.name;
        menu.push({
          tag: tag,
          id: id,
          prerelease: prerelease,
          description: description,
          release: title
        });
        if (!prerelease) {
          // if a release is found, stop generating the menu
          return false;
        }
      });
      return menu;
    },
    flashMessage(message, error) {
      this.$store.dispatch("Deployer/flashMessage", {
        message: message,
        error: error
      });
    },
    getExtension(asset) {
      let substringArray = asset.split(".");
      return substringArray[substringArray.length - 1];
    },
    handleSuccessfulInstall(download, tag) {
      this.$store.dispatch("Deployer/setProgress", {
        tool: download.name,
        title: `Successfully Installed!`,
        value: 100
      });
      this.$store
        .dispatch("Deployer/updateInstall", { repo: download.name, tag: tag })
        .then(() => {
          this.stopDeploying();
          this.flashMessage(
            `Successfully installed: ${download.name} ${tag}`,
            false
          );
        });
    },
    handleAPIError(error) {
      this.stopDeploying();
      this.flashMessage(error.response.data.message, true);
    },
    handleInstallError(error) {
      console.log(error);
      this.stopDeploying();
      this.flashMessage(error, true);
    }
  },
  computed: {
    downloadSelected() {
      return this.$store.state.Deployer.downloadSelected;
    },
    computerName() {
      return process.env.COMPUTERNAME;
    },
    installs() {
      return this.$store.state.Deployer.installs;
    },
    releases() {
      return this.$store.state.Deployer.releases;
    }
  }
};
</script>

<style lang="sass" scoped>
  td.insights
    width: 20px
  td.tool
    width: 200px
  td.description
    width: 250px
  td.version
    width: 40px
  td.action:not(:last-child)
    padding-left: 4px
    padding-right: 4px
  button.is-rounded
    height: 18px
  button.uninstall
    margin-left: 8px
  i.expand 
    color: $info
    cursor: pointer
  i.yellow
    color: $yellow
  i.red
    color: $danger
  .dropdown
    margin-top: 1px
  span.icon.admin
    cursor: pointer
  table
    font-size: 14px
  .table-title
    font-size: 12px
    font-weight: bold
    text-align: center
    color: lighten($info, 20)
  .download-title
    font-size: 13px
    font-weight: bold
  .download-description
    font-size: 12px
    color: lighten($dark, 50)
</style>
