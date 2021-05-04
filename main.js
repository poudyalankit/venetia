const { app, BrowserWindow, ipcMain, BrowserView, dialog, protocol, session } = require('electron')
const { autoUpdater } = require("electron-updater")
const electron = require('electron');
const client = require('discord-rich-presence')('768276915651739678');
const fs = require('fs')
var path = require('path')
const configDir = (electron.app).getPath('userData');
const express = require('express');
const captchaSharing = express();


async function checkMultipleInstances() {
    const got = require('got');
    try {
        let response = await got('http://localhost:4444/toastyaio/datadome')
        app.quit()
    } catch (error) {
        captchaSharing.listen(process.env.PORT || 4444, function() {
            console.log('server running on port 4444', '')
        });
    }
}


checkMultipleInstances()


var cookieBank = []
var captchas = []
var setToSolving = []
var solvecaptcha = []
var proxyUsername;
var proxyPassword;

autoUpdater.setFeedURL('https://venetiabots.com/update/download')

ipcMain.on('update', (event) => {
    const dialogOpts = {
        type: 'info',
        buttons: ['Close'],
        title: 'Checking for updates',
        detail: 'Checking for the latest update. Please standby.'
    }

    dialog.showMessageBox(dialogOpts)
    autoUpdater.checkForUpdates()
});

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
    const dialogOpts = {
        type: 'info',
        buttons: ['Restart'],
        title: 'Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart now to complete the update.'
    }

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.quitAndInstall()
    })
})


autoUpdater.on('update-not-available', () => {
    const dialogOpts = {
        type: 'info',
        buttons: ['Close'],
        title: 'Update',
        detail: 'You are on the latest version.'
    }

    dialog.showMessageBox(dialogOpts)
});

autoUpdater.on('error', message => {
    console.error('There was a problem updating the application')
    console.error(message)
})




captchaSharing.get("/toastyaio/datadome", async(req, res) => {
    res.json(cookieBank)
});

captchaSharing.get("/venetia/captchabank", async(req, res) => {
    res.json(captchas)
});

captchaSharing.get("/venetia/removefrombank", async(req, res) => {
    for (var i = 0; i < captchas.length; i++) {
        if (captchas[i].id === req.query.id) {
            captchas.splice(i, 1)
            res.send("removed from bank")
        }
    }
    res.send("failed removing")
});

captchaSharing.get("/venetia/captchas", async(req, res) => {
    captchas.push({ id: req.query.id, token: req.query.token })
    res.send("added to solved bank")
});

captchaSharing.get("/venetia/setToSolving", async(req, res) => {
    setToSolving.push({ id: req.query.id, windowid: req.query.windowid })
    res.send("added to solving bank")
});

captchaSharing.get("/venetia/getCaptchaID", async(req, res) => {
    console.log(req.query.windowid)
    for (var i = 0; i < setToSolving.length; i++) {
        if (setToSolving[i].windowid === req.query.windowid) {
            var captchaid = setToSolving[i].id
            setToSolving.splice(i, 1)
            res.send(captchaid)
        }
    }
    res.send("error finding captcha")
});



captchaSharing.get("/venetia/solvecaptcha", async(req, res) => {
    res.json(solvecaptcha)
});

captchaSharing.get("/venetia/addToQueue", async(req, res) => {
    var id2 = makeid(5)
    solvecaptcha.push({ site: req.query.site, sitekey: req.query.sitekey, id: id2 })
    res.json({ id: id2 })
});

captchaSharing.get("/venetia/retrieveCaptcha", async(req, res) => {
    for (var i = 0; i < captchas.length; i++) {
        if (captchas[i].id === req.query.id) {
            res.json({ solved: true, token: captchas[i].token })
        }
    }
    res.json({ solved: false })
});


captchaSharing.get("/venetia/removeFromQueue", async(req, res) => {
    for (var i = 0; i < solvecaptcha.length; i++) {
        if (solvecaptcha[i].id === req.query.id) {
            solvecaptcha.splice(i, 1)
            break;
        }
    }
    res.send("removed from queue")
});

captchaSharing.get("/toastyaio/addCookie", async(req, res) => {
    cookieBank.push({ cookie: req.query.cookie, uses: 0 })
    res.send("added")
});

captchaSharing.get("/toastyaio/addUse", async(req, res) => {
    for (var i = 0; i < cookieBank.length; i++) {
        if (cookieBank[i].cookie === req.query.cookie) {
            cookieBank[i].uses = cookieBank[i].uses + 1;
        }
    }
    res.send("added")
});


setInterval(function() {
    for (var i = 0; i < cookieBank.length; i++) {
        if (cookieBank[i].uses > 20)
            cookieBank.splice(i, 1);
    }
}, 5000);



let taskArray = []


let win;

client.updatePresence({
    details: 'v0.3.15',
    startTimestamp: Date.now(),
    largeImageKey: "venetia",
    largeImageText: "Venetia",
    instance: true,
});

function keyAuth() {
    keyAuthWindow = new BrowserWindow({
        width: 682,
        height: 366,
        backgroundColor: '#181a26',
        icon: path.join(__dirname, 'images/logo.png'),
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            devTools: false
        }
    })
    keyAuthWindow.openDevTools(true)
    keyAuthWindow.loadFile('auth.html');
    keyAuthWindow.setMenuBarVisibility(false);
    keyAuthWindow.setResizable(false);

}

function createWindow() {
    win = new BrowserWindow({
        width: 1255,
        height: 780,
        backgroundColor: '#181a26',
        icon: path.join(__dirname, 'images/logo.png'),
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            devTools: false
        }
    })
    win.openDevTools(true)
    win.loadFile('index.html');
    win.setMenuBarVisibility(false);
    win.setResizable(false);
    win.on('closed', () => app.quit());

    backendA = new BrowserWindow({
        width: 200,
        height: 50,
        backgroundColor: '#181a26',
        icon: path.join(__dirname, 'images/logo.png'),
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            //devTools: false
        }
    })
    backendA.openDevTools(true)
    backendA.loadFile('backend.html');
    backendA.setMenuBarVisibility(false);
    backendA.setResizable(false);


    backendB = new BrowserWindow({
        width: 200,
        height: 50,
        backgroundColor: '#181a26',
        icon: path.join(__dirname, 'images/logo.png'),
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            // devTools: false
        }
    })
    backendB.openDevTools(true)
    backendB.loadFile('backend.html');
    backendB.setMenuBarVisibility(false);
    backendB.setResizable(false);
}

var backendArray = ['backendA', 'backendB']

app.whenReady(() => {
    app.allowRendererProcessReuse = false;
})

app.whenReady().then(keyAuth)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        keyAuth()
    }
})

app.on('login', (event, webContents, request, authInfo, callback) => {
    callback(proxyUsername, proxyPassword);
});

ipcMain.on('updateStatus1', (event, taskID, status) => {
    win.webContents.send('updateStatus', taskID, status)
});

ipcMain.on('updateProductTitle1', (event, taskID, title) => {
    win.webContents.send('updateProductTitle', taskID, title)
});

ipcMain.on('taskinfo', (event, taskInfo) => {
    var groups = JSON.parse(fs.readFileSync(path.join(configDir, '/userdata/tasks.json'), { encoding: 'utf8', flag: 'r' }));
    taskInfo = {
        "id": taskInfo.taskID,
        "site": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['site'],
        "mode": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['mode'],
        "product": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['product'],
        "size": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['size'],
        "profile": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['profile'],
        "proxies": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['proxies'],
        "accounts": groups[taskInfo.groupIndex][taskInfo.groupName][taskInfo.taskIndex][taskInfo.taskID]['accounts']
    }
    var x = backendArray.sample()
    console.log(x)
    if (x === 'backendA')
        backendA.webContents.send('taskinfo1', taskInfo)
    else if (x === 'backendB')
        backendB.webContents.send('taskinfo1', taskInfo)
});

ipcMain.on('stopTask', (event, taskNumber) => {
    backendA.webContents.send('stopTask1', taskNumber)
    backendB.webContents.send('stopTask1', taskNumber)
});


ipcMain.on('reverify', (event, key) => {
    const got = require('got');
    got({
        method: 'get',
        url: "https://venetiabots.com/api/activate?key=" + key,
        responseType: 'json'
    }).then(response => {
        if (response.body.exists === "false") {
            app.quit()
        } else if (response.body.activated === "true" && response.body.ipMatch === "false") {
            app.quit()
        } else if (response.body.activated === "false") {
            app.quit()
        }
    }).catch(error => {
        console.log(error)
        app.quit()
    })
});


ipcMain.on('verify', (event, key) => {
    const got = require('got');
    got({
        method: 'get',
        url: "https://venetiabots.com/api/activate?key=" + key,
        responseType: 'json'
    }).then(response => {
        if (response.body.activated === "true" && response.body.ipMatch === "true") {
            createWindow()
            keyAuthWindow.close()
        } else
        if (response.body.activated === "false") {
            createWindow()
            keyAuthWindow.close()
        } else if (response.body.exists === "false")
            keyAuthWindow.webContents.send("alert", "Key does not exist.")
        else if (response.body.activated === "true" && response.body.ipMatch === "false")
            keyAuthWindow.webContents.send("alert", "Key active on another IP.")
    }).catch(error => {
        console.log(error)
        app.quit()
    })
});






ipcMain.on('launchHarvester', function(event, harvesterName, harvesterProxy) {
    var sess = session.fromPartition('persist:' + harvesterName);
    if (harvesterProxy != "") {
        var x = harvesterProxy.split(":")
        if (x.length == 2)
            sess.setProxy({ proxyRules: "http://" + harvesterProxy })
        else if (x.length == 4) {
            proxyUsername = x[2]
            proxyPassword = x[3]
            var newProxy = x[0] + ":" + x[1]
            sess.setProxy({ proxyRules: "http://" + newProxy })
        }
    } else {
        sess.setProxy({ proxyRules: "" })
    }

    sess.protocol.interceptBufferProtocol('http', (req, callback) => {
        if (req.url == 'http://www.supremenewyork.com/') {
            fs.readFile(__dirname + '/solveharvester.html', 'utf8', function(err, html) {
                callback({ mimeType: 'text/html', data: Buffer.from(html) });
            });
        }
    });
    var harvester = new BrowserWindow({
        width: 400,
        height: 600,
        backgroundColor: '#181a26',
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            devTools: false,
            webSecurity: false,
            session: sess
        },

        frame: false,
        icon: path.join(__dirname, 'images/logo.png')
    })
    harvester.setTitle("Venetia Harvester");
    harvester.setMenuBarVisibility(false);
    harvester.setResizable(false);

    harvester.loadFile('harvester.html', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36' })
    harvester.openDevTools(true)
});

ipcMain.on('googleSignIn', function(event, harvesterName, harvesterProxy) {
    var sess2 = session.fromPartition('persist:' + harvesterName);
    if (harvesterProxy != "") {
        var x = harvesterProxy.split(":")
        if (x.length == 2)
            sess2.setProxy({ proxyRules: "http://" + harvesterProxy })
        else if (x.length == 4) {
            proxyUsername = x[2]
            proxyPassword = x[3]
            var newProxy = x[0] + ":" + x[1]
            sess2.setProxy({ proxyRules: "http://" + newProxy })
        }
    } else {
        sess2.setProxy({ proxyRules: "" })
    }
    var login = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            devTools: false,
            webSecurity: false,
            session: sess2
        },
        icon: path.join(__dirname, 'images/logo.png')
    })
    login.setMenuBarVisibility(false);

    login.setResizable(true);
    login.loadURL('https://accounts.google.com/', { userAgent: 'Chrome' })
    login.openDevTools(true)
});
Array.prototype.sample = function() {
    return this[Math.floor(Math.random() * this.length)];
}
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}