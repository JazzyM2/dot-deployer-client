<template>
  <div class="admin animated fadeIn">
    <div class="columns">
      <div class="column is-7">
        <div class="field has-addons">
          <div class="control">
            <input
              v-model="investigate"
              class="input is-small is-info"
              type="text"
              :placeholder="`search ${installs.length} users...`"
            >
          </div>
        </div>
        <table class="table is-striped is-narrow is-hoverable">
          <tbody>
            <tr
              v-for="(install, index) in searchedInstalls"
              :key="install.key"
              @mouseover="installClicked = searchedInstalls[index]"
              @mouseleave="installClicked = null"
            >
              <td>{{ install.key }}</td>
              <td>
                {{ install.user }}
                <i>({{ Object.keys(install.installs).length }})</i>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="column admin">
        <!-- ADMIN TABLE -->
        <div v-if="installClicked == null">
          <div class="field has-addons animated fadeIn">
            <div class="control">
              <input
                v-model="search"
                class="input is-small is-info"
                type="text"
                :placeholder="`search ${admins.length} developers...`"
              >
            </div>
            <div class="control">
              <button class="button is-primary is-small is-outlined" @click="launchModal()">Add</button>
            </div>
          </div>
          <table class="table is-striped is-narrow is-hoverable animated fadeIn">
            <tbody>
              <tr
                v-for="(admin, index) in searchedAdmins"
                @mouseover="hoveredAdmin = index"
                @mouseleave="hoveredAdmin = null"
                :key="index"
              >
                <td>{{ admin.email }}</td>
                <button
                  v-if="hoveredAdmin === index"
                  class="editadmin animated fadeIn is-outlined is-small button is-danger"
                  @click="deleteAdmin(admin)"
                >Remove</button>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- ADMIN TABLE -->
        <div class="notification animated fadeIn is-white" v-else>
          <div class="control" v-for="(value, key) in installClicked.installs" :key="key">
            <div class="tags has-addons is-left">
              <span class="animated fadeIn tag is-dark">{{ key }}</span>
              <span class="animated fadeIn tag is-primary">{{ value.tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- MODAL CARD -->
    <div v-if="modalActive" class="modal is-active animated fadeIn">
      <div class="modal-background" @click="closeModal()"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Add Developer</p>
        </header>
        <section class="modal-card-body">
          <div class="field">
            <label class="label">Email</label>
            <div class="control">
              <input
                ref="searchBox"
                v-model="input"
                class="input is-info is-small"
                type="text"
                placeholder="jon.doe@wework.com"
              >
            </div>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button
            :class="{'is-outlined': true, 'button': true, 'is-success': true, 'is-loading': saving, 'is-small': true}"
            @click="addAdmin()"
          >Save</button>
          <button class="button is-outlined is-danger is-small" @click="closeModal()">Cancel</button>
        </footer>
      </div>
    </div>
    <!-- MODAL CARD -->
  </div>
</template>

<script>
import { flattenObject } from "../store/helpers";
const _ = require("lodash");

export default {
  name: "Developers",
  data() {
    return {
      modalActive: false,
      input: "",
      search: "",
      investigate: "",
      saving: false,
      hoveredAdmin: null,
      installClicked: null
    };
  },
  methods: {
    rowClicked(index) {
      this.installClicked = this.installs[index];
    },
    launchModal() {
      this.modalActive = true;
      this.$nextTick(() => {
        this.$refs.searchBox.focus();
      });
    },
    closeModal() {
      this.modalActive = false;
    },
    deleteAdmin(admin) {
      this.$store.dispatch("Deployer/deleteAdmin", admin.key);
    },
    addAdmin() {
      this.saving = true;
      if (this.input) {
        this.$store.dispatch("Deployer/addAdmin", this.input);
      }
      this.doneSaving();
    },
    doneSaving() {
      this.saving = false;
      this.closeModal();
      this.input = "";
    }
  },
  computed: {
    admins() {
      return flattenObject(this.$store.state.Deployer.admins);
    },
    searchedAdmins() {
      if (!this.search) {
        return this.admins;
      } else {
        let returnAdmins = [];
        _.forEach(this.admins, admin => {
          if (admin.email.includes(this.search)) {
            returnAdmins.push(admin);
          }
        });
        return returnAdmins;
      }
    },
    installs() {
      return flattenObject(this.$store.state.Deployer.installs);
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
  button.editadmin
    height: 15px
    padding: 4px
    padding-top: 2px
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
