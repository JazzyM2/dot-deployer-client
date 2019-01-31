<template>
  <div class="admin animated fadeIn">
    <div class="columns">
      <div class="column is-7">
        <div class="field has-addons">
          <div class="control">
            <b-autocomplete
              :keep-first="true"
              :clear-on-select="true"
              size="is-small"
              type="is-dark"
              v-model="investigate"
              :data="filteredInstallsArray()"
              :placeholder="`search ${installs.length} computers...`"
              icon-pack="fa"
              icon="user"
              @select="user => showUserInstalls(user)"
            ></b-autocomplete>
          </div>
        </div>
      </div>
      <div class="column admin">
        <!-- ADMIN TABLE -->
        <div v-if="installClicked == null">
          <div class="field has-addons animated fadeIn">
            <div class="control">
              <b-autocomplete
                :keep-first="true"
                :clear-on-select="true"
                size="is-small"
                type="is-dark"
                v-model="search"
                :data="filteredUsersArray()"
                :placeholder="`search ${users.length} users...`"
                icon-pack="fa"
                icon="user"
                @select="user => toggleUserPermissions(user)"
              ></b-autocomplete>
            </div>
          </div>
        </div>
        <!-- ADMIN TABLE -->
        <div
          @mouseover="installClicked = null"
          class="notification animated fadeIn is-white"
          v-else
        >
          <div class="control" v-for="(value, key) in installClicked.installs" :key="key">
            <div class="tags has-addons is-left">
              <span class="animated fadeIn tag is-dark">{{ findRepoFromKey(key) }}</span>
              <span class="animated fadeIn tag is-primary">{{ value.tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { flattenObject } from "../helpers.js";
const _ = require("lodash");
const firebase = require("firebase");

export default {
  name: "Admin",
  mounted() {
    // this bit of code allows for hot reload to work when on install tab
    if (!this.userEmail) {
      this.$router.push("/");
    }
  },
  data() {
    return {
      input: "",
      search: "",
      investigate: "",
      saving: false,
      hoveredAdmin: null,
      installClicked: null
    };
  },
  methods: {
    showUserInstalls(user) {
      if (user) {
        this.installClicked = _.find(this.installs, install => {
          if (install.user == user) {
            return install;
          }
        });
      }
    },
    toggleUserPermissions(user) {
      if (user) {
        console.log(user);
      }
    },
    filteredUsersArray() {
      return _.map(this.users, "name");
    },
    filteredInstallsArray() {
      return _.map(this.installs, "user");
    },
    findRepoFromKey(key) {
      let repo = _.find(this.metadata, obj => {
        if (obj.id == key) {
          return obj;
        }
      });
      if (repo) {
        return repo.name;
      } else {
        return "";
      }
    }
  },
  computed: {
    userEmail() {
      let user = firebase.auth().currentUser;
      return user ? firebase.auth().currentUser.email : null;
    },
    users() {
      return flattenObject(this.$store.state.Deployer.users);
    },
    searchedUsers() {
      if (!this.search) {
        return this.users;
      } else {
        let returnedUsers = [];
        _.forEach(this.users, user => {
          if (user.name.toLowerCase().includes(this.search)) {
            returnedUsers.push(user);
          }
        });
        return returnedUsers;
      }
    },
    installs() {
      return flattenObject(this.$store.state.Deployer.installs);
    },
    metadata() {
      return flattenObject(this.$store.state.Deployer.metadata);
    },
    searchedInstalls() {
      if (this.investigate) {
        return _.filter(this.installs, install => {
          let s = this.investigate.toLowerCase();
          return install.user.toLowerCase().includes(s);
        });
      } else {
        return this.installs;
      }
    },
    installCount() {
      return this.installs.length;
    }
  }
};
</script>

<style lang="sass" scoped>
  div.column.admin
    margin-left: -40px
  div.notification
    position: fixed
  span.tag
    font-size: 14px
  input.input
    width: 250px
  div.admin
    margin-left: 8px
    font-family: $font-stack
  // button.editadmin
  //   height: 15px
  //   padding: 4px
  //   padding-top: 2px
  table
    font-size: 14px
  span.icon
    cursor: pointer
  i.danger
    color: $danger
  i.trash
    color: $warning
  i.add 
    color: $primary
  i.expand 
    color: $info
    cursor: pointer
</style>
