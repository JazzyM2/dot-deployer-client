<template>
  <div class="modal is-active animated fadeIn">
    <div class="modal-background" @click="close()"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ title }}</p>
      </header>
      <div class="modal-card-body">
        {{ message }}
      </div>
      <footer class="modal-card-foot">
        <button class="button is-small is-outlined is-success" @click="yes()">Yes</button>
        <button class="button is-small is-outlined is-danger" @click="close()">Cancel</button>
      </footer>
    </div>
  </div>
</template>

<script>

export default {
  name: 'Modal',
  props: ['title', 'message'],
  methods: {
    close () {
      this.$emit('close')
    },
    yes () {
      this.$emit('yes')
    }
  }
}
</script>

<style lang="sass" scoped>
</style>