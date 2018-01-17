process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
process.on('uncaughtException', function (error) {
  console.log(error);
  if (error.code == 'ECONNRESET') {
    spotifyPortOffset++;
    console.log('connection failed; trying new port...');
  }
});

const https = require('https');
const exec = require('child_process').exec;
const request = require('request');

const SERVER_PORT = 5000;
const UPDATE_INTERVAL = 1000;
const DEFAULT_RETURN_ON = ['login', 'logout', 'play', 'pause', 'error', 'ap'];
let spotifyPortOffset = 0;
const DEFAULT_HTTPS_CONFIG = {
  host: '',
  port: 4380,
  path: '',
  headers: {
    'Origin': 'https://open.spotify.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
  }
};

let config;
let version;
version = {};
version.running = false;
let csrf;
let oauth;
let albumId;
let coverUrl;
let mainWindow;
let mod;
let trackUri;
let volume;

function copyConfig() {
  let configCopy = JSON.parse(JSON.stringify(DEFAULT_HTTPS_CONFIG));
  configCopy.port += (spotifyPortOffset % 10);
  return configCopy;
}

module.exports = {};

module.exports.generateLocalHostname = function() {
  /*return randomstring.generate({
    length: 10,
    charset: 'abcdefghijklmnopqrstuvwxyz'
  }) + '.spotilocal.com';*/
  return '127.0.0.1';
};

module.exports.generateUrl = function(host, port, path) {
  return `http${port == 443 ? 's' : ''}://${host}:${port}${path}`;
}

module.exports.getUrl = function(path) {
  mod.generateLocalHostname() + '/' + path;
};

module.exports.getJson = function(config, callback) {
  var options = {
    url: mod.generateUrl(config.host, config.port, config.path),
    rejectUnauthorized: false,
    headers: config.headers
  }
  request(options, function (error, response, body) {
    //console.log('error:', error);
    //console.log('statusCode:', response && response.statusCode);
    console.log('body:', body);
    callback(JSON.parse(body));
  });
};

module.exports.getStatus = function() {
  config = copyConfig();
  config.host = mod.generateLocalHostname();
  config.path = '/remote/status.json?oauth=' + oauth + '&csrf=' + csrf + '&returnafter=1&returnon=' + DEFAULT_RETURN_ON.join();
  mod.getJson(config, function(data) { console.log(data); });
};

module.exports.getCurrentAlbumId = function() {
  config = copyConfig();
  config.host = mod.generateLocalHostname();
  config.path = '/remote/status.json?oauth=' + oauth + '&csrf=' + csrf + '&returnafter=1&returnon=' + DEFAULT_RETURN_ON.join();
  mod.getJson(config, function(data) {
    //console.log(data);
    if (typeof mainWindow !== 'undefined') {
      mainWindow.webContents.send('running', data.running);
    }
    try {
      if (data.track.album_resource.uri !== albumId) {
        console.log('album updated');
        albumId = data.track.album_resource.uri;
        track = data.track;
        console.log(albumId);
        mod.getAlbumCover(albumId);
      }
      else {
        if (typeof mainWindow !== 'undefined') {
          mainWindow.webContents.send('coverUrl', coverUrl);
        }
      }
      if (typeof mainWindow !== 'undefined') {
        console.log("VOLUME is =" + data.volume);
        mainWindow.webContents.send('position', (data.playing_position / data.track.length) * 100);
        mainWindow.webContents.send('length', data.track.length);
        mainWindow.webContents.send('playing', data.playing);
        mainWindow.webContents.send('shuffle', data.shuffle);
        mainWindow.webContents.send('volume', data.volume);
        mainWindow.webContents.send('repeat', data.repeat);
        mainWindow.webContents.send('next_enabled', data.next_enabled);
        mainWindow.webContents.send('prev_enabled', data.prev_enabled);
        mainWindow.webContents.send('track', data.track.track_resource.name);
        mainWindow.webContents.send('album', data.track.album_resource.name);
        mainWindow.webContents.send('artist', data.track.artist_resource.name);
      }
    }
    catch(ex) {
      console.log(ex);
    }
  });
};

module.exports.seek = function(percent) {
  var time = (percent / 100) * track.length;
  exec('osascript -e \'tell application "Spotify" to set player position to ' + time + '\'');
};

module.exports.pause = function(pause) {
  exec('osascript -e \'tell application "Spotify" to ' + pause ? 'pause' : 'play' + '\'');
};

module.exports.playpause = function() {
  exec('osascript -e \'tell application "Spotify" to playpause\'');
};

module.exports.skip = function(forward) {
  exec('osascript -e \'tell application "Spotify" to ' + (forward ? 'next' : 'previous') + ' track\'');
};

module.exports.repeat = function(repeating) {
  exec('osascript -e \'tell application "Spotify" to set repeating to ' + repeating + '\'');
};

module.exports.shuffle = function(shuffle) {
  exec('osascript -e \'tell application "Spotify" to set shuffling to ' + shuffle + '\'');
};

module.exports.setVolume = function(newVolume) {
  console.log("VOLUME VOLUME TO ="+newVolume);
  if(newVolume > 1) newVolume = 1;
  if(newVolume < 0) newVolume = 0;
  newVolume = newVolume * 100;
  exec('osascript -e \'tell application "Spotify" to set sound volume to ' + newVolume + '\'');
  //exec('osascript -e \'tell application "Spotify" set the sound volume to '+ volume + '\'');
}

module.exports.getAlbumCover = function(id) {
  mod = this;
  config = copyConfig();
  config.host = 'open.spotify.com';
  config.path = '/oembed?url=' + id;
  config.port = 443;
  mod.getJson(config, function(data) {
    console.log(data.thumbnail_url);
    coverUrl = data.thumbnail_url;
    if (typeof mainWindow !== 'undefined') {
      mainWindow.webContents.send('coverUrl', coverUrl);
    }
  });
};

module.exports.grabTokens = function() {
  if (typeof mainWindow !== 'undefined') {
    mainWindow.webContents.send('loadingText', 'Connecting to Spotify...');
  }
  config = copyConfig();
  config.host = mod.generateLocalHostname();
  config.path = '/simplecsrf/token.json';
  mod.getJson(config, function(data) { csrf = data.token; });
  config.host = 'open.spotify.com';
  config.path = '/token';
  config.port = 443;
  mod.getJson(config, function(data) { oauth = data.t; });
  let updateTrackCover;
  let waitForRequest = setInterval(function() {
    if (typeof version !== 'undefined' && typeof csrf !== 'undefined' && typeof oauth !== 'undefined') {
      clearInterval(waitForRequest);
      console.log('done.');
      console.log(version);
      console.log(csrf);
      console.log(oauth);
      updateTrackCover = setInterval(mod.getCurrentAlbumId, UPDATE_INTERVAL);
    }
    else {
      console.log('waiting for authentication...');
    }
  }, 500);
};

module.exports.setWindow = function(window) {
  mainWindow = window;
  //console.log(mainWindow);
};

module.exports.init = function() {
  mod = this;
  let waitForSpotify = setInterval(function() {
    if (typeof version !== 'undefined' && version.running) {
      clearInterval(waitForSpotify);
      mod.grabTokens();
    }
    else {
      config = copyConfig();
      config.host = mod.generateLocalHostname();
      config.path = '/service/version.json?service=remote';
      mod.getJson(config, function(data, port) {
        if (!('running' in data)) {
          data.running = true;
        }
        version = data;
        console.log(version);
        console.log('port: ' + port);
        config.port = port;
      });
      console.log('waiting for spotify...');
      config.port++;
    }
  }, 500);
}
