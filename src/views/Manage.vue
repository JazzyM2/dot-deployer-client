<template>
  <div class="manage animated fadeIn">
    <dottable class="released" :source="getSource" :admin="isAdmin"></dottable>
    <!-- LOADING SCREEN -->
    <div v-if="deploying && progress != null" class="modal is-active animated fadeIn">
      <div class="modal-background"></div>
      <div class="modal-content">
        <div class="level">
          <div class="level-item has-text-centered">
            <div class="progress-tool">{{ progress.tool | capitalize }}</div>
            <div class="progress-title">{{ progress.title }}</div>
          </div>
        </div>
        <div class="level">
          <div class="level-item has-text-centered">
            <progress class="progress is-small is-light" :value="progress.value" max="100"></progress>
          </div>
        </div>
        <div class="level">
          <div class="level-item has-text-centered">
            <button class="loading button is-loading is-outlined is-light is-small"></button>
          </div>
        </div>
      </div>
    </div>
    <!-- LOADING SCREEN -->
    <!-- DOWNLOAD INSIGHTS -->
    <div v-if="modalActive" class="modal is-active animated fadeIn">
      <div class="modal-background" @click="closeModal()"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">{{ downloadSelected.name | capitalize }}</p>
        </header>
        <div class="modal-card-body">
          <div class="tags has-addons">
            <span class="tag is-dark">Documentation</span>
            <span class="tag is-light">
              <a @click="launchUrl(getUrl('documentation'))">{{ getUrl('documentation') }}</a>
            </span>
          </div>
          <div class="tags has-addons">
            <span class="tag is-danger">Support</span>
            <span class="tag is-light">
              <a @click="launchUrl(getUrl('support'))">{{ getUrl('support') }}</a>
            </span>
          </div>
        </div>
        <footer class="modal-card-foot">
          <button class="button is-small is-outlined is-dark" @click="closeModal()">Close</button>
        </footer>
      </div>
    </div>
    <!-- DOWNLOAD INSIGHTS -->
  </div>
</template>

<script>
import DotTable from "@/components/DotTable";

import { ownerId, flattenObject } from "../helpers.js";
const _ = require("lodash");
const firebase = require("firebase");
const { shell } = require("electron");

export default {
  name: "Manage",
  components: {
    dottable: DotTable
  },
  methods: {
    getUrl(type) {
      let identity = ownerId(this.downloadSelected);
      let deploy = this.deployers[identity];
      if (deploy) {
        if (deploy[type]) {
          return deploy[type].url;
        } else {
          return "";
        }
      }
    },
    launchUrl(url) {
      shell.openExternal(url);
    },
    closeModal() {
      this.$store.dispatch("Deployer/setModalActive", false);
      this.$store.dispatch("Deployer/setDownloadSelected", null);
    }
  },
  computed: {
    downloadSelected() {
      return this.$store.state.Deployer.downloadSelected;
    },
    modalActive() {
      return this.$store.state.Deployer.modalActive;
    },
    message() {
      return this.$store.state.Deployer.message;
    },
    deploying() {
      return this.$store.state.Deployer.deploying;
    },
    progress() {
      return this.$store.state.Deployer.progress;
    },
    repositories() {
      return this.$store.state.Deployer.repositories.repositories;
    },
    metadata() {
      return flattenObject(this.$store.state.Deployer.metadata);
    },
    // unreleased() {
    //   let unreleased = [];
    //   _.forEach(this.repositories, repo => {
    //     if (!_.find(this.metadata, { id: repo.id })) {
    //       unreleased.push(repo);
    //     }
    //   });
    //   return unreleased;
    // },
    users() {
      return this.$store.state.Deployer.users;
    },
    userEmail() {
      return firebase.auth().currentUser.email;
    },
    isAdmin() {
      let user = _.find(this.users, { email: this.userEmail });
      return user.role == "admin";
    },
    getSource() {
      if (this.isAdmin) {
        return this.repositories;
      } else {
        // TODO return a list of repositories that match the users role
        return [];
      }
    }
  }
};
</script>

<style lang="sass" scoped>
  div.manage
    font-family: $font-stack
  div.progress-tool
    font-weight: bold
    color: $light
    font-size: 16px
  div.progress-title
    color: $light
    padding-left: 12px
    font-style: italic
    font-size: 13px
  button.loading 
    border: none
</style>
