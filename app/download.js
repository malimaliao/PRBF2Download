$(() => {
    const remote = require('electron').remote;
    const app = remote.app;
    var torrents = require('torrent-stream');
    const fs = require('fs');
    const path = require('path');
    const shell = require('electron').shell;
    let spawn = require("child_process").spawn, child;
    const prettyBytes = require('pretty-bytes');
    const humanizeDuration = require('humanize-duration');
    const win = remote.getCurrentWindow();

    let installerName = 'none';
    let installerFolder = 'none';
    const versionInformationURL = 'https://d76a05d74f889aafd38d-39162a6e09ffdab7394e3243fa2342c1.ssl.cf2.rackcdn.com/version.json';
    let paused = false;
    let completed = false;
    const configPath = path.join(app.getPath('userData'), 'config.json');

    function getVersionBig(handleData) {
        $.ajax({
            url: versionInformationURL,
            success:function(data) {
                handleData(data.version_big);
            }
        });
    }

    function getTorrentMagnet(handleData) {
        $.ajax({
            url: versionInformationURL,
            success:function(data) {
                handleData(data.torrent_magnet);
            }
        });
    }

    function getTorrentSetupName(handleData) {
        $.ajax({
            url: versionInformationURL,
            success:function(data) {
                handleData(data.torrent_setupname);
            }
        });
    }

    function getTorrentFolderName(handleData) {
        $.ajax({
            url: versionInformationURL,
            success:function(data) {
                handleData(data.torrent_foldername);
            }
        });
    }

    function getDownloadStoragePath() {
        return JSON.parse(fs.readFileSync(configPath)).downloadStoragePath;
    }

    function onCancelButtonPress() {
        win.setProgressBar(0, {mode: "normal"});
        win.loadFile('./app/cancel.html')
    }

    function onInstallButtonPress() {
        shell.showItemInFolder(path.join(getDownloadStoragePath(), installerFolder, installerName));
        child = spawn(path.join(getDownloadStoragePath(), installerFolder, installerName));

    }

    function onRemoveButtonPress() {
        win.loadFile('./app/remove.html')
    }

    function onMinimizeButtonPress() {
        win.minimize();
    }

    function onWebsiteLinkPress() {
        shell.openExternal('https://www.realitymod.com')
    }

    function onPRManualLinkPress() {
        shell.openExternal('https://www.realitymod.com/manual')
    }

    function onGithubLinkPress() {
        shell.openExternal('https://github.com/WouterJansen/PRBF2Download')
    }

    function onCloseButtonPress() {
        app.quit();
        win.close();
    }

    function onTorrentContinueButtonPress() {
        $('#torrent-pause').css('color', 'white');
        $('#torrent-start').css('color', '#5a5757');
        engine.swarm.pause();
        paused = false;
        $('#progress-information-time').text('Verifying Files...');
    }


    function onTorrentPauseButtonPress() {
        $('#torrent-start').css('color','white');
        $('#torrent-pause').css('color','#5a5757');
        engine.swarm.resume();
        $('#progress-information-size').text(' ');
        $('#progress-information-time').text('Paused...');
        $('#progress-information-speed').text(' ');
        paused = true;
    }

    function notChoked (result, wire) {
        return result + (wire.peerChoking ? 0 : 1)
    }

    document.querySelector('#install-button').addEventListener('click', onInstallButtonPress);
    document.querySelector('#cancel-button').addEventListener('click', onCancelButtonPress);
    document.querySelector('#close-button').addEventListener('click', onCloseButtonPress);
    document.querySelector('#remove-button').addEventListener('click', onRemoveButtonPress);
    document.querySelector('#minimize-button').addEventListener('click', onMinimizeButtonPress);
    document.querySelector('#website-link').addEventListener('click', onWebsiteLinkPress);
    document.querySelector('#github-link').addEventListener('click', onGithubLinkPress);
    document.querySelector('#prbf2-manual-link').addEventListener('click', onPRManualLinkPress);
    document.querySelector('#torrent-start').addEventListener('click', onTorrentContinueButtonPress);
    document.querySelector('#torrent-pause').addEventListener('click', onTorrentPauseButtonPress);

    $('#torrent-pause').css('visibility', 'hidden');
    $('#torrent-start').css('visibility', 'hidden');

    getVersionBig(function(version){
        $('#prbf2-version').text(version);
    });

    getTorrentSetupName(function(torrent_setupname){
        installerName = torrent_setupname;
    });

    getTorrentFolderName(function(torrent_foldername){
        installerFolder = torrent_foldername;
    });

    getTorrentMagnet(function(torrent_magnetname){
        opts = {}
        opts.name = "TorrentFiles"
        opts.tmp = app.getPath('userData');
        opts.path = getDownloadStoragePath();
        opts.fastresume = true;
        var engine = torrents(torrent_magnetname, opts);

        engine.on('ready', function () {
            engine.files.forEach(function (file) {
                file.select()
            });
            var timeStart = (new Date()).getTime();

            let interval = setInterval(function () {
                if(!paused) {
                    var percentage = ((engine.swarm.downloaded / engine.torrent.length) * 100).toPrecision(4);
                    var torrentSize = engine.torrent.length;
                    var bytesRemaining = torrentSize - engine.swarm.downloaded;

                    if (percentage > 100) { percentage = 100 };
                    win.setProgressBar(percentage / 100, {mode: "normal"});
                    $('#progress-bar').attr('aria-valuenow', percentage);
                    $('#progress-bar').css('width', percentage + '%');
                    $('#progress-bar').text(Math.round(percentage) + '%');
                    if (Math.round(percentage) === 100) {
                        $('#progress-information-size').text(' ');
                        $('#progress-information-time').text('Verifying Files...');
                        $('#progress-information-speed').text(' ');
                        $('#progress-information-size').text(prettyBytes(engine.swarm.downloaded) + '/' + prettyBytes(torrentSize));
                        var timeNow = (new Date()).getTime();
                        var timeElapsed = timeNow - timeStart;
                        var timeRemaining = (((timeElapsed / engine.swarm.downloaded) * bytesRemaining)).toPrecision(6);
                        $('#progress-information-time').text(humanizeDuration(timeRemaining, {
                            round: true,
                            largest: 2
                        }) + ' remaining');
                        $('#progress-information-speed').text(prettyBytes(engine.swarm.downloadSpeed()) + '/s from ' + engine.swarm.wires.reduce(notChoked, 0) + ' peers');
                    } else {
                        $('#progress-information-size').text(prettyBytes(engine.swarm.downloaded) + '/' + prettyBytes(torrentSize));
                        var timeNow = (new Date()).getTime();
                        var timeElapsed = timeNow - timeStart;
                        var timeRemaining = (((timeElapsed / engine.swarm.downloaded) * bytesRemaining)).toPrecision(6);
                        $('#progress-information-time').text(humanizeDuration(timeRemaining, {
                            round: true,
                            largest: 2
                        }) + ' remaining');
                        $('#progress-information-speed').text(prettyBytes(engine.swarm.downloadSpeed()) + '/s from ' + engine.swarm.wires.reduce(notChoked, 0) + ' peers');
                    }
                }else{
                    clearInterval(interval);
                }
            }, 1000);

            engine.on('idle', function () {
                if(!completed){
                    win.setProgressBar(1, {mode: "normal"});
                    completed = true;
                    app.setAppUserModelId("PRBF2-Download-Assistant");
                    let notification = {
                        title: "PR:BF2 Download Assistant",
                        body: "Download Complete",
                        icon: './assets/icons/png/256x256.png'
                    };
                    let myNotification = new window.Notification(notification.title, notification);

                    myNotification.onclick = () => {
                        win.show();
                    };
                    $('#progress-bar').attr('aria-valuenow', 100);
                    $('#progress-bar').css('width', 100 + '%');
                    $('#progress-bar').text('Completed');
                    $('#progress-bar').attr('class', 'progress-bar progress-bar-striped');
                    $('#progress-information').css('visibility', 'hidden');
                    $('#install-container').css('visibility', 'visible');
                    // $('#torrent-pause').css('visibility', 'hidden');
                    // $('#torrent-start').css('visibility', 'hidden');
                    clearInterval(interval);
                    $('#install-instructions').text('');
                    $('#install-button').css('visibility', 'visible');
                    $('#cancel-button').css('visibility', 'hidden');
                    $('#remove-button').css('visibility', 'visible');
                    engine.destroy();
                }

            })
        });
    });

});