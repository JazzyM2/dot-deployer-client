'use strict'

import {
  app,
  protocol,
  BrowserWindow
} from 'electron'

import {
  createProtocol,
  installVueDevtools
} from 'vue-cli-plugin-electron-builder/lib'

import {
  Toast
} from 'buefy/dist/components/toast'

const {
  autoUpdater
} = require("electron-updater")

autoUpdater.on('checking-for-update', () => {
  console.log('Auto Updater Checking For Update...')
  Toast.open({
    message: "Checking for an update...",
    position: "is-bottom",
    type: "is-info"
  });
})

autoUpdater.on('update-available', () => {
  Toast.open({
    message: "Update Available!",
    position: "is-bottom",
    type: "is-success"
  });
})

autoUpdater.on('update-not-available', () => {
  Toast.open({
    message: "No Update Available",
    position: "is-bottom",
    type: "is-info"
  });
})

autoUpdater.on('error', (error) => {
  Toast.open({
    message: `Error: ${error}`,
    position: "is-bottom",
    type: "is-danger"
  });
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  Toast.open({
    message: log_message,
    position: "is-bottom",
    type: "is-info"
  });
})

autoUpdater.on('update-downloaded', () => {
  Toast.open({
    message: "Update Downloaded!",
    position: "is-bottom",
    type: "is-success"
  });
  // trigger app to close and update install
  // autoUpdater.quitAndInstall();
});

const isDevelopment = process.env.NODE_ENV !== 'production'

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

// require necessary modules for authenticator
const http = require('http')
const url = require('url')
const querystring = require('querystring')
const opn = require('opn')
const destroyer = require('server-destroy')
const {
  google
} = require('googleapis')
const {
  ipcMain
} = require('electron')

// setup authenticator in the main process
ipcMain.on('authenticate', (event, client) => {
  const oauth2Client = new google.auth.OAuth2(
    client.id,
    client.secret,
    'http://localhost:3000/oauth2callback'
  )
  google.options({
    auth: oauth2Client
  })
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: 'profile email'
  })
  const server = http.createServer(async (req, res) => {
    if (req.url.indexOf('/oauth2callback') > -1) {
      const qs = querystring.parse(url.parse(req.url).query)
      res.end('Successfully Authenticated!  You can close this tab and return to the Deployer application!')
      server.destroy()
      const {
        tokens
      } = await oauth2Client.getToken(qs.code)
      event.sender.send('tokens', tokens)
    }
  }).listen(3000, () => {
    opn(authorizeUrl, {
      wait: false
    }).then(cp => cp.unref())
  })
  destroyer(server)
})

// Standard scheme must be registered before the app is ready
protocol.registerStandardSchemes(['app'], {
  secure: true
})

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 835,
    height: 400,
    maximizable: false,
    closable: false,
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: true
    }
  })

  if (isDevelopment || process.env.IS_TEST) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }

  win.on('closed', () => {
    win = null
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    await installVueDevtools()
  }
  createWindow()
})

app.on('ready', function () {
  autoUpdater.checkForUpdatesAndNotify();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', data => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}
