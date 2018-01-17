const menubar = require('menubar');
const electron = require('electron');
const AutoLaunch = require('auto-launch');

const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const mb = menubar();

mb.setOption('preloadWindow', true);
mb.setOption('height', 464);

const spotify = require('./spotify.js');

const ipcMain = require('electron').ipcMain;

let settingsWindow;
let aboutWindow;

let appLauncher = new AutoLaunch({
  name: 'spotifymenubar'
});

let settings = {
  showTrackTitle: true,
  smallAlbumArt: false
};

const contextMenu = Menu.buildFromTemplate([
  { label: 'About Baritone', click: function() { openAbout(); } },
  /*{ label: 'Preferences', click: function() { openSettings(); } },*/
  { type: 'separator' },
  { label: 'Launch on Login', type: 'checkbox', checked: false, click: function(item) {
    appLauncher.isEnabled().then(function(enabled) {
      if (enabled) {
        return appLauncher.disable().then(function() {
          item.checked = false;
        });
      }
      else {
        return appLauncher.enable().then(function() {
          item.checked = true;
        });
      }
    });
  } },
  { label: 'Show Track Info', type: 'checkbox', checked: false, click: function(item) {
    settings.showTrackTitle = !settings.showTrackTitle;
    item.checked = settings.showTrackTitle;
    mb.window.webContents.send('settings', settings);
  }, enabled: true },
  /*{ label: 'Smaller Album Art', type: 'checkbox', checked: false, click: function(item) {
    settings.smallAlbumArt = !settings.smallAlbumArt;
    item.checked = settings.smallAlbumArt;
    mb.window.webContents.send('settings', settings);
  }, enabled: false },*/
  { type: 'separator' },
  { label: 'Quit Baritone', click: function() { mb.app.quit(); } }
]);

appLauncher.isEnabled().then(function(enabled) {
  contextMenu.items[2].checked = enabled;
});

contextMenu.items[3].checked = settings.showTrackTitle;
//contextMenu.items[4].checked = settings.smallAlbumArt;

function openSettings() {
  settingsWindow = new BrowserWindow({width: 400, height: 500});
  settingsWindow.loadURL('file://' + __dirname + '/settings.html');
  settingsWindow.on('closed', function () {
    settingsWindow = null;
  });
}

function openAbout() {
  aboutWindow = new BrowserWindow({width: 400, height: 320});
  aboutWindow.loadURL('file://' + __dirname + '/about.html');
  aboutWindow.on('closed', function () {
    aboutWindow = null;
  });
}

mb.on('ready', function ready() {
  console.log('app is ready');
  spotify.init();
  mb.tray.on('right-click', function() {
    mb.tray.popUpContextMenu(contextMenu);
  });
});

mb.on('after-create-window', function() {
  spotify.setWindow(mb.window);
  mb.window.webContents.send('settings', settings);
});

ipcMain.on('seek', function(event, percent) {
  spotify.seek(percent);
});

ipcMain.on('playpause', function(event, data) {
  spotify.playpause();
});

ipcMain.on('skip', function(event, data) {
  spotify.skip(data);
});

ipcMain.on('shuffle', function(event, data) {
  spotify.shuffle(data);
});

ipcMain.on('setVolume', function(event, data) {
  spotify.setVolume(data);
})

ipcMain.on('repeat', function(event, data) {
  spotify.repeat(data);
});