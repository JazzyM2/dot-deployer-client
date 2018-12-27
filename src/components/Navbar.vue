<template>
  <div class="nav">
    <!-- MESSAGE MODAL -->
    <div v-if="message !== null" class="modal is-active animated fadeIn">
      <div class="modal-background"></div>
      <div
        :class="{'notification': true, 'is-primary': !message.error, 'is-danger': message.error}"
      >{{ message.message | capitalize }}</div>
    </div>
    <!-- MESSAGE MODAL -->
    <!-- NAVIGATION BAR -->
    <nav class="animated fadeInDown level">
      <div class="level-left has-text-centered">
        <img class="logo" src="@/assets/logo.png">
        <img class="banner" src="@/assets/banner.png">
        <b class="version">{{ version }}</b>
      </div>
      <div class="level-right has-text-centered">
        <img class="photo" :src="userImage">
        <button class="button signout is-rounded is-small is-light is-outlined" @click="signOut()">
          <b>Sign Out</b>
        </button>
      </div>
    </nav>
    <!-- NAVIGATION BAR -->
    <!-- MENU BAR -->
    <div class="animated fadeIn level">
      <div class="level-left">
        <button
          v-if="isAdmin"
          :class="{'menu-item-left': true, 'button': true, 'is-small': true, 'is-outlined': route !== 'manage', 'is-dark': true}"
          @click="goTo('manage')"
        >Manage</button>
        <button
          v-if="isAdmin"
          :class="{'menu-item-left': true, 'button': true, 'is-small': true, 'is-outlined': route !== 'developers', 'is-dark': true}"
          @click="goTo('developers')"
        >Developers</button>
      </div>
      <div class="level-right">
        <button
          @click="launchUrl(getUrl('documentation'))"
          v-if="help"
          onclick="this.blur();"
          class="animated fadeInRight button help menu-item-right is-small is-outlined is-info"
        >Documentation</button>
        <button
          @click="launchUrl(getUrl('feedback'))"
          v-if="help"
          onclick="this.blur();"
          class="animated fadeInRight button help menu-item-right is-small is-outlined is-info"
        >Feedback</button>
        <button
          @click="launchUrl(getUrl('support'))"
          v-if="help"
          onclick="this.blur();"
          class="animated fadeInRight button help menu-item-right is-small is-outlined is-info"
        >Support</button>
        <button
          @click="help = !help"
          onclick="this.blur();"
          class="button help menu-item-right is-small is-outlined is-info"
        >Help</button>
      </div>
    </div>
    <!-- MENU BAR -->
  </div>
</template>

<script>
const firebase = require("firebase");
const { shell } = require("electron");
// const { app } = require("electron").remote;
const _ = require("lodash");

export default {
  name: "Navbar",
  data() {
    return {
      help: false
    };
  },
  methods: {
    getUrl(type) {
      try {
        return this.deployers["WeConnect/dot-deployer-app"][type].url;
      } catch (error) {
        return null; // eslint-disable-line
      }
    },
    launchUrl(url) {
      if (url) {
        shell.openExternal(url);
      }
    },
    goTo(endpoint) {
      this.$router.push(endpoint);
    },
    signOut() {
      firebase.auth().signOut();
    }
  },
  computed: {
    route() {
      return this.$route.name;
    },
    userImage() {
      return firebase.auth().currentUser.photoURL;
    },
    message() {
      return this.$store.state.Deployer.message;
    },
    deployers() {
      return this.$store.state.Deployer.deployers;
    },
    admins() {
      return this.$store.state.Deployer.admins;
    },
    installs() {
      return this.$store.state.Deployer.installs;
    },
    userEmail() {
      return firebase.auth().currentUser.email;
    },
    isAdmin() {
      return _.find(this.admins, { email: this.userEmail });
    },
    version() {
      return process.env.VUE_APP_VERSION;
    }
  }
};
</script>

<style lang="sass" scoped>
  div.nav
    font-family: $font-stack
  nav.level
    height: 50px
    background: $nav-background
  nav.level:not(:last-child)
    margin-bottom: 0px
  img.logo
    height: 30px
    margin-left: 12px
  img.photo
    height: 35px
    border-radius: 50%
  img.banner
    height: 35px
  span.icon
    cursor: pointer
    margin-left: 8px
    margin-right: -8px
  button.menu-item-left
    margin-right: 4px
    height: 20px
    margin-top: -1px
  button.menu-item-right
    margin-left: 4px
    height: 20px
    margin-top: -1px
  button.signout
    height: 20px
    margin-right: 12px
    margin-left: 12px
  b.version
    font-size: 20px
    padding-left: 2px
    padding-top: 6px
    color: darken($info, 25)
  button.help 
    border: none
</style>
