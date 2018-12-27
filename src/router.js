import Vue from 'vue'
import Router from 'vue-router'

import Navbar from '@/components/Navbar'

import Login from '@/views/Login'
import Manage from '@/views/Manage'
import Developers from '@/views/Developers'

Vue.use(Router)

export default new Router({
  routes: [{
      path: '/',
      name: 'login',
      components: {
        navbar: null,
        main: Login
      },
      meta: {
        requiresAuth: false
      }
    },
    {
      path: '/manage',
      name: 'manage',
      components: {
        navbar: Navbar,
        main: Manage
      },
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/developers',
      name: 'developers',
      components: {
        navbar: Navbar,
        main: Developers
      },
      meta: {
        requiresAuth: true
      }
    }
  ]
})
