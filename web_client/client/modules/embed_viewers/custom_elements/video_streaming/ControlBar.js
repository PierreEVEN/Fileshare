/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @module ControlBar
 * @param {object=} dashjsMediaPlayer - dashjs reference
 * @param {boolean=} displayUTCTimeCodes - true if time is displayed in UTC format, false otherwise
 */
// eslint-disable-next-line no-unused-vars
class ControlBar {
    constructor(dashjsMediaPlayer, displayUTCTimeCodes, elements) {

        this._elements = elements;
        this.displayUTCTimeCodes = displayUTCTimeCodes;
        this.player = this.player = dashjsMediaPlayer;

        this.captionMenu = null;
        this.bitrateListMenu = null;
        this.trackSwitchMenu = null;
        this.menuHandlersList = {
            bitrate: null,
            caption: null,
            track: null
        };
        this.lastVolumeLevel = NaN;
        this.seeking = false;
        this.videoControllerVisibleTimeout = 0;
        this.liveThresholdSecs = 1;
        this.textTrackList = {};
        this.forceQuality = false;
        this.video = null;
        this.videoContainer = null;
        this.videoController = null;
        this.playPauseBtn = null;
        this.bitrateListBtn = null;
        this.captionBtn = null;
        this.trackSwitchBtn = null;
        this.seekbar = null;
        this.seekbarPlay = null;
        this.seekbarBuffer = null;
        this.muteBtn = null;
        this.nativeTextTracks = null;
        this.volumebar = null;
        this.fullscreenBtn = null;
        this.timeDisplay = null;
        this.durationDisplay = null;
        this.thumbnailContainer = null;
        this.thumbnailElem = null;
        this.thumbnailTimeLabel = null;
        this.idSuffix = null;
        this.seekbarBufferInterval = null;

        //************************************************************************************
        // THUMBNAIL CONSTANTS
        //************************************************************************************
        // Maximum percentage of player height that the thumbnail will fill
        this.maxPercentageThumbnailScreen = 0.15;
        // Separation between the control bar and the thumbnail (in px)
        this.bottomMarginThumbnail = 10;
        // Maximum scale so small thumbs are not scaled too high
        this.maximumScale = 2;
    }

    initControls(suffix) {
        this.idSuffix = suffix;
        this.videoController = this._elements.videoController;
        this.playPauseBtn = this._elements.playPauseBtn;
        this.bitrateListBtn = this._elements.bitrateListBtn;
        this.captionBtn = this._elements.captionBtn;
        this.trackSwitchBtn = this._elements.trackSwitchBtn;
        this.seekbar = this._elements.seekbar;
        this.seekbarPlay = this._elements.seekbar_play;
        this.seekbarBuffer = this._elements.seekbar_buffer;
        this.muteBtn = this._elements.muteBtn;
        this.volumebar = this._elements.volumebar;
        this.fullscreenBtn = this._elements.fullscreenBtn;
        this.timeDisplay = this._elements.videoTime;
        this.durationDisplay = this._elements.videoDuration;
        this.thumbnailContainer = this._elements.thumbnail_container;
        this.thumbnailElem = this._elements.thumbnail_elem;
        this.thumbnailTimeLabel = this._elements.thumbnail_time_label;
    };

    addPlayerEventsListeners() {
        this.player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, this._onPlayStart, this);
        this.player.on(dashjs.MediaPlayer.events.PLAYBACK_PAUSED, this._onPlaybackPaused, this);
        this.player.on(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, this._onPlayTimeUpdate, this);
        this.player.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, this._onStreamActivated, this);
        this.player.on(dashjs.MediaPlayer.events.STREAM_DEACTIVATED, this._onStreamDeactivated, this);
        this.player.on(dashjs.MediaPlayer.events.STREAM_TEARDOWN_COMPLETE, this._onStreamTeardownComplete, this);
        this.player.on(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, this._onTracksAdded, this);
        this.player.on(dashjs.MediaPlayer.events.BUFFER_LEVEL_UPDATED, this._onBufferLevelUpdated, this);
        this.player.on(dashjs.MediaPlayer.events.NEW_TRACK_SELECTED, this._onNewTrackSelected, this);
        this.player.on(dashjs.Protection.events.KEY_STATUSES_MAP_UPDATED, this._onKeyStatusChanged, this);
    };

    removePlayerEventsListeners() {
        this.player.off(dashjs.MediaPlayer.events.PLAYBACK_STARTED, this._onPlayStart, this);
        this.player.off(dashjs.MediaPlayer.events.PLAYBACK_PAUSED, this._onPlaybackPaused, this);
        this.player.off(dashjs.MediaPlayer.events.PLAYBACK_TIME_UPDATED, this._onPlayTimeUpdate, this);
        this.player.off(dashjs.MediaPlayer.events.STREAM_ACTIVATED, this._onStreamActivated, this);
        this.player.off(dashjs.MediaPlayer.events.STREAM_DEACTIVATED, this._onStreamDeactivated, this);
        this.player.off(dashjs.MediaPlayer.events.STREAM_TEARDOWN_COMPLETE, this._onStreamTeardownComplete, this);
        this.player.off(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, this._onTracksAdded, this);
        this.player.off(dashjs.MediaPlayer.events.BUFFER_LEVEL_UPDATED, this._onBufferLevelUpdated, this);
        this.player.off(dashjs.MediaPlayer.events.NEW_TRACK_SELECTED, this._onNewTrackSelected, this);
        this.player.off(dashjs.Protection.events.KEY_STATUSES_MAP_UPDATED, this._onKeyStatusChanged, this);
    };

    getControlId(id) {
        return id + (this.idSuffix ? this.idSuffix : '');
    };

    setPlayer(player) {
        if (this.player) {
            this.removePlayerEventsListeners();
        }
        this.player = player;
        this.addPlayerEventsListeners();
    };

    //************************************************************************************
    // PLAYBACK
    //************************************************************************************

    togglePlayPauseBtnState() {
        if (this.player.isPaused()) {
            this.setPlayBtn();
        } else {
            this.setPauseBtn();
        }
    };

    setPlayBtn() {
        let span = this._elements.iconPlayPause;
        if (span !== null) {
            span.classList.remove('icon-pause');
            span.classList.add('icon-play');
        }
    };

    setPauseBtn() {
        let span = this._elements.iconPlayPause;
        if (span !== null) {
            span.classList.remove('icon-play');
            span.classList.add('icon-pause');
        }
    };

    _onPlayPauseClick = () => {
        this.togglePlayPauseBtnState(this);
        this.player.isPaused() ? this.player.play() : this.player.pause();
    };

    _onPlaybackPaused = () => {
        this.togglePlayPauseBtnState();
    };

    _onPlayStart = () => {
        this.setTime(this.displayUTCTimeCodes ? this.player.timeAsUTC() : this.player.timeInDvrWindow());
        this.updateDuration();
        this.togglePlayPauseBtnState();
        if (this.seekbarBufferInterval) {
            clearInterval(this.seekbarBufferInterval);
        }
    };

    _onPlayTimeUpdate = () => {
        this.updateDuration();
        if (!this.seeking) {
            this.setTime(this.displayUTCTimeCodes ? this.player.timeAsUTC() : this.player.timeInDvrWindow());
            if (this.seekbarPlay) {
                this.seekbarPlay.style.width = Math.max((this.player.timeInDvrWindow() / this.player.duration() * 100), 0) + '%';
            }

            if (this.seekbar.getAttribute('type') === 'range') {
                this.seekbar.value = this.player.timeInDvrWindow();
            }

        }
    };

    getBufferLevel() {
        let bufferLevel = 0;
        if (this.player.getDashMetrics) {
            let dashMetrics = this.player.getDashMetrics();
            if (dashMetrics) {
                bufferLevel = dashMetrics.getCurrentBufferLevel('video', true);
                if (!bufferLevel) {
                    bufferLevel = dashMetrics.getCurrentBufferLevel('audio', true);
                }
            }
        }
        return bufferLevel;
    };

    //************************************************************************************
    // VOLUME
    //************************************************************************************

    toggleMuteBtnState() {
        let span = this._elements.iconMute;
        if (this.player.isMuted()) {
            span.classList.remove('icon-mute-off');
            span.classList.add('icon-mute-on');
        } else {
            span.classList.remove('icon-mute-on');
            span.classList.add('icon-mute-off');
        }
    };

    onMuteClick = () => {
        if (this.player.isMuted() && !isNaN(this.lastVolumeLevel)) {
            this.setVolume(this.lastVolumeLevel);
        } else {
            this.lastVolumeLevel = parseFloat(this.volumebar.value);
            this.setVolume(0);
        }
        this.player.setMute(this.player.getVolume() === 0);
        this.toggleMuteBtnState();
    };

    setVolume = (value) => {
        if (typeof value === 'number') {
            this.volumebar.value = value;
        }
        this.player.setVolume(parseFloat(this.volumebar.value));
        this.player.setMute(this.player.getVolume() === 0);
        if (isNaN(this.lastVolumeLevel)) {
            this.lastVolumeLevel = this.player.getVolume();
        }
        this.toggleMuteBtnState();
    };

    //************************************************************************************
    // SEEKING
    // ************************************************************************************

    calculateTimeByEvent(event) {
        let seekbarRect = this.seekbar.getBoundingClientRect();
        return Math.floor(this.player.duration() * (event.clientX - seekbarRect.left) / seekbarRect.width);
    };

    onSeeking = (event) => {
        //TODO Add call to seek in trick-mode once implemented. Preview Frames.
        this.seeking = true;
        let mouseTime = this.calculateTimeByEvent(event);
        if (this.seekbarPlay) {
            this.seekbarPlay.style.width = (mouseTime / this.player.duration() * 100) + '%';
        }
        this.setTime(mouseTime);
        document.addEventListener('mousemove', this.onSeekBarMouseMove, true);
        document.addEventListener('mouseup', this.onSeeked, true);
    };

    onSeeked = (event) => {
        this.seeking = false;
        document.removeEventListener('mousemove', this.onSeekBarMouseMove, true);
        document.removeEventListener('mouseup', this.onSeeked, true);

        // seeking
        let mouseTime = this.calculateTimeByEvent(event);
        if (!isNaN(mouseTime)) {
            mouseTime = mouseTime < 0 ? 0 : mouseTime;
            this.player.seek(mouseTime);
        }

        this.onSeekBarMouseMoveOut(event);

        if (this.seekbarPlay) {
            this.seekbarPlay.style.width = (mouseTime / this.player.duration() * 100) + '%';
        }
    };

    onSeekBarMouseMove = (event) => {
        if (!this.thumbnailContainer || !this.thumbnailElem) return;

        // Take into account page offset and seekbar position
        let elem = this.videoContainer || this.video;
        let videoContainerRect = elem.getBoundingClientRect();
        let seekbarRect = this.seekbar.getBoundingClientRect();
        let videoControllerRect = this.videoController.getBoundingClientRect();

        // Calculate time position given mouse position
        let left = event.clientX - seekbarRect.left;
        let mouseTime = this.calculateTimeByEvent(event);
        if (isNaN(mouseTime)) return;

        // Update timer and play progress bar if pointerdown (mouse click down)
        if (this.seeking) {
            this.setTime(mouseTime);
            if (this.seekbarPlay) {
                this.seekbarPlay.style.width = (mouseTime / this.player.duration() * 100) + '%';
            }
        }

        // Get thumbnail information
        if (this.player.provideThumbnail) {
            this.player.provideThumbnail(mouseTime, (thumbnail) => {

                if (!thumbnail) return;

                // Adjust left variable for positioning thumbnail with regards to its viewport
                left += (seekbarRect.left - videoContainerRect.left);
                // Take into account thumbnail control
                let ctrlWidth = parseInt(window.getComputedStyle(this.thumbnailElem).width);
                if (!isNaN(ctrlWidth)) {
                    left -= ctrlWidth / 2;
                }

                let scale = (videoContainerRect.height * this.maxPercentageThumbnailScreen) / thumbnail.height;
                if (scale > this.maximumScale) {
                    scale = this.maximumScale;
                }

                // Set thumbnail control position
                this.thumbnailContainer.style.left = left + 'px';
                this.thumbnailContainer.style.display = '';
                this.thumbnailContainer.style.bottom += Math.round(videoControllerRect.height + this.bottomMarginThumbnail) + 'px';
                this.thumbnailContainer.style.height = Math.round(thumbnail.height) + 'px';

                this.thumbnailElem.style.background = 'url("' + thumbnail.url + '") ' + (thumbnail.x > 0 ? '-' + thumbnail.x : '0') +
                    'px ' + (thumbnail.y > 0 ? '-' + thumbnail.y : '0') + 'px';
                this.thumbnailElem.style.width = thumbnail.width + 'px';
                this.thumbnailElem.style.height = thumbnail.height + 'px';
                this.thumbnailElem.style.transform = 'scale(' + scale + ',' + scale + ')';

                if (this.thumbnailTimeLabel) {
                    this.thumbnailTimeLabel.textContent = this.displayUTCTimeCodes ? this.player.formatUTC(mouseTime) : this.player.convertToTimeCode(mouseTime);
                }
            });
        }
    };

    onSeekBarMouseMoveOut = () => {
        if (!this.thumbnailContainer) return;
        this.thumbnailContainer.style.display = 'none';
    };

    seekLive() {
        this.player.seekToOriginalLive();
    };

    //************************************************************************************
    // TIME/DURATION
    //************************************************************************************
    setDuration(value) {
        if (this.player.isDynamic()) {
            this.durationDisplay.textContent = '● LIVE';
            if (!this.durationDisplay.onclick) {
                this.durationDisplay.onclick = this.seekLive;
                this.durationDisplay.classList.add('live-icon');
            }
        } else if (!isNaN(value) && isFinite(value)) {
            this.durationDisplay.textContent = this.displayUTCTimeCodes ? this.player.formatUTC(value) : this.player.convertToTimeCode(value);
            this.durationDisplay.classList.remove('live-icon');
        }
    };

    setTime(value) {
        if (value < 0) {
            return;
        }
        if (this.player.isDynamic() && this.player.duration()) {
            let liveDelay = Math.max(this.player.duration() - value, 0);
            let targetLiveDelay = this.player.getTargetLiveDelay();

            if (liveDelay < targetLiveDelay + this.liveThresholdSecs) {
                this.durationDisplay.classList.add('live');
            } else {
                this.durationDisplay.classList.remove('live');
            }
            this.timeDisplay.textContent = '- ' + this.player.convertToTimeCode(liveDelay);
        } else if (!isNaN(value)) {
            this.player.seek(value)
            this.timeDisplay.textContent = this.displayUTCTimeCodes ? this.player.formatUTC(value) : this.player.convertToTimeCode(value);
        }
    };

    updateDuration() {
        let duration = this.player.duration();
        if (duration !== parseFloat(this.seekbar.max)) { //check if duration changes for live streams..
            this.setDuration(this.displayUTCTimeCodes ? this.player.getDvrWindow().endAsUtc : duration);
            this.seekbar.max = duration;
        }
    };

    //************************************************************************************
    // FULLSCREEN
    //************************************************************************************

    onFullScreenChange = () => {
        let icon;
        if (this.isFullscreen()) {
            this.enterFullscreen();
            icon = this.fullscreenBtn.querySelector('.icon-fullscreen-enter');
            icon.classList.remove('icon-fullscreen-enter');
            icon.classList.add('icon-fullscreen-exit');
        } else {
            this.exitFullscreen();
            icon = this.fullscreenBtn.querySelector('.icon-fullscreen-exit');
            icon.classList.remove('icon-fullscreen-exit');
            icon.classList.add('icon-fullscreen-enter');
        }
    };

    isFullscreen() {
        return document.fullscreenElement || document.msFullscreenElement || document.mozFullScreen || document.webkitIsFullScreen;
    };

    enterFullscreen() {
        let element = this.videoContainer || this.video;
        if (!document.fullscreenElement) {
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else {
                element.webkitRequestFullScreen();
            }
        }

        this.videoController.classList.add('video-controller-fullscreen');
        window.addEventListener('mousemove', this.onFullScreenMouseMove);
        this.onFullScreenMouseMove();
    };

    onFullScreenMouseMove = () => {
        this.clearFullscreenState();
        this.videoControllerVisibleTimeout = setTimeout(() => {
            this.videoController.classList.add('hide');
        }, 4000);
    };

    clearFullscreenState() {
        clearTimeout(this.videoControllerVisibleTimeout);
        this.videoController.classList.remove('hide');
    };

    exitFullscreen() {
        window.removeEventListener('mousemove', this.onFullScreenMouseMove);
        this.clearFullscreenState();

        if (document.fullscreenElement) {

            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else {
                document.webkitCancelFullScreen();
            }
        }

        this.videoController.classList.remove('video-controller-fullscreen');
    };

    onFullscreenClick = () => {
        if (!this.isFullscreen()) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
        if (this.captionMenu) {
            this.captionMenu.classList.add('hide');
        }
        if (this.bitrateListMenu) {
            this.bitrateListMenu.classList.add('hide');
        }
        if (this.trackSwitchMenu) {
            this.trackSwitchMenu.classList.add('hide');
        }
    };

    //************************************************************************************
    // Audio Video MENU
    //************************************************************************************

    _onStreamDeactivated(e) {
        if (e.streamInfo && this.textTrackList[e.streamInfo.id]) {
            delete this.textTrackList[e.streamInfo.id];
        }
    };

    _onStreamActivated(e) {
        let streamInfo = e.streamInfo;

        this.updateDuration();

        //Bitrate Menu
        this.createBitrateSwitchMenu();

        //Track Switch Menu
        this.createTrackSwitchMenu();

        //Text Switch Menu
        this.createCaptionSwitchMenu(streamInfo);
    };

    createBitrateSwitchMenu() {
        if (this.bitrateListBtn) {
            this.destroyMenu(this.bitrateListMenu, this.bitrateListBtn, this.menuHandlersList.bitrate);
            this.bitrateListMenu = null;
            let availableBitrates = {menuType: 'bitrate'};
            availableBitrates.audio = this.player.getRepresentationsByType && this.player.getRepresentationsByType('audio') || [];
            availableBitrates.video = this.player.getRepresentationsByType && this.player.getRepresentationsByType('video') || [];
            availableBitrates.images = this.player.getRepresentationsByType && this.player.getRepresentationsByType('image') || [];

            if (availableBitrates.audio.length >= 1 || availableBitrates.video.length >= 1 || availableBitrates.images.length >= 1) {
                let contentFunc = (element, index) => {
                    let result = isNaN(index) ? ' Auto Switch' : Math.floor(element.bitrateInKbit) + ' kbps';
                    result += element && element.width && element.height ? ' (' + element.width + 'x' + element.height + ')' : '';
                    result += element && element.codecs ? ' (' + element.codecs + ')' : '';
                    return result;
                };

                this.bitrateListMenu = this.createMenu(availableBitrates, contentFunc);
                let func = () => {
                    this.onMenuClick(this.bitrateListMenu, this.bitrateListBtn);
                };
                this.menuHandlersList.bitrate = func;
                this.bitrateListBtn.addEventListener('click', func);
                this.bitrateListBtn.classList.remove('hide');

            } else {
                this.bitrateListBtn.classList.add('hide');
            }
        }
    };

    createTrackSwitchMenu() {
        let contentFunc;

        if (this.trackSwitchBtn) {

            this.destroyMenu(this.trackSwitchMenu, this.trackSwitchBtn, this.menuHandlersList.track);
            this.trackSwitchMenu = null;

            let availableTracks = {menuType: 'track'};
            availableTracks.audio = this.player.getTracksFor('audio');
            availableTracks.video = this.player.getTracksFor('video'); // these return empty arrays so no need to check for null

            if (availableTracks.audio.length > 1 || availableTracks.video.length > 1) {
                contentFunc = (element) => {
                    let label = this.getLabelForLocale(element.labels);
                    let info = '';

                    if (element.lang) {
                        info += 'Language - ' + element.lang + ' ';
                    }

                    if (element.roles && element.roles.length > 0) {
                        info += '- Role: ' + element.roles[0].value + ' ';
                    }

                    if (element.accessibility && element.accessibility.length > 0) {
                        info += '- Accessibility: ' + element.accessibility[0].value + ' ';
                    }

                    if (element.codec) {
                        info += '- Codec: ' + element.codec + ' ';
                    }

                    if (element.id) {
                        info += '- Id: ' + element.id + ' ';
                    }

                    return label || info
                };
                this.trackSwitchMenu = this.createMenu(availableTracks, contentFunc);
                let func = () => {
                    this.onMenuClick(this.trackSwitchMenu, this.trackSwitchBtn);
                };
                this.menuHandlersList.track = func;
                this.trackSwitchBtn.addEventListener('click', func);
                this.trackSwitchBtn.classList.remove('hide');
            }
        }
    };

    // Match up the current dashjs text tracks against native video element tracks by ensuring they have matching properties
    _matchTrackWithNativeTrack(track, nativeTrack) {
        let label = track.id !== undefined ? track.id.toString() : track.lang;

        return !!(
            (track.kind === nativeTrack.kind) &&
            (track.lang === nativeTrack.language) &&
            (track.isTTML === nativeTrack.isTTML) &&
            (track.isEmbedded === nativeTrack.isEmbedded) &&
            (label === nativeTrack.label)
        );
    }

    // Compare track information against native video element tracks to get the current track mode
    _getNativeVideoTrackMode(track) {
        const nativeTracks = this.video.textTracks;
        let trackMode;
        for (let i = 0; i < nativeTracks.length; i++) {
            const nativeTrack = nativeTracks[i];
            if (this._matchTrackWithNativeTrack(track, nativeTrack)) {
                trackMode = nativeTrack.mode;
                break;
            }
        }

        return (trackMode === undefined) ? 'showing' : trackMode;
    };

    createCaptionSwitchMenu(streamId) {
        /*
        // Subtitles/Captions Menu //XXX we need to add two layers for captions & subtitles if present.
        let activeStreamInfo = this.player.getActiveStream().getStreamInfo();

        if (this.captionBtn && (!activeStreamInfo.id || activeStreamInfo.id === streamId)) {

            this.destroyMenu(this.captionMenu, this.captionBtn, this.menuHandlersList.caption);
            this.captionMenu = null;

            let tracks = this.textTrackList[streamId] || [];
            let contentFunc = (element, index) => {
                if (isNaN(index)) {
                    return {
                        mode: 'showing',
                        text: 'OFF'
                    };
                }

                let label = this.getLabelForLocale(element.labels);
                let trackText;
                if (label) {
                    trackText = label + ' : ' + element.type;
                } else {
                    trackText = element.lang + ' : ' + element.kind;
                }

                return {
                    mode: this._getNativeVideoTrackMode(element),
                    text: trackText
                }
            };
            this.captionMenu = this.createMenu({menuType: 'caption', arr: tracks}, contentFunc);

            let func = () => {
                this.onMenuClick(this.captionMenu, this.captionBtn);
            };

            this.menuHandlersList.caption = func;
            this.captionBtn.addEventListener('click', func);
            this.captionBtn.classList.remove('hide');
        }*/

    };

    _onTracksChanged() {
        let activeStreamInfo = this.player.getActiveStream().getStreamInfo();
        this.createCaptionSwitchMenu(activeStreamInfo.id);
    }

    _onTracksAdded(e) {
        // Subtitles/Captions Menu //XXX we need to add two layers for captions & subtitles if present.
        if (!this.textTrackList[e.streamId]) {
            this.textTrackList[e.streamId] = [];
        }

        this.textTrackList[e.streamId] = this.textTrackList[e.streamId].concat(e.tracks);

        this.nativeTextTracks = this.video.textTracks;
        this.nativeTextTracks.addEventListener('change', this._onTracksChanged);

        this.createCaptionSwitchMenu(e.streamId);
    };

    _onNewTrackSelected() {
        this.createTrackSwitchMenu();
        this.createBitrateSwitchMenu();
    }

    _onKeyStatusChanged() {
        this.createBitrateSwitchMenu();
    }

    _onBufferLevelUpdated() {
        if (this.seekbarBuffer) {
            this.seekbarBuffer.style.width = ((this.player.timeInDvrWindow() + this.getBufferLevel()) / this.player.duration() * 100) + '%';
        }
    };

    _onStreamTeardownComplete() {
        this.setPlayBtn();
        this.timeDisplay.textContent = '00:00';
    };

    createMenu(info, contentFunc) {
        let menuType = info.menuType;
        let el = document.createElement('div');
        el.id = menuType + 'Menu';
        el.classList.add('menu');
        el.classList.add('hide');
        el.classList.add('unselectable');
        el.classList.add('menu-item-unselected');
        this.videoController.appendChild(el);

        switch (menuType) {
            case 'caption':
                el.appendChild(document.createElement('ul'));
                el = this.createMenuContent(el, this.getMenuContent(menuType, info.arr, contentFunc), 'caption', menuType + '-list');
                this.setMenuItemsState(this.getMenuInitialIndex(info, menuType), menuType + '-list');
                break;
            case 'track':
            case 'bitrate':
                if (info.video.length >= 1) {
                    el.appendChild(this.createMediaTypeMenu('video'));
                    el = this.createMenuContent(el, this.getMenuContent(menuType, info.video, contentFunc), 'video', 'video-' + menuType + '-list');
                    this.setMenuItemsState(this.getMenuInitialIndex(info.video, menuType, 'video'), 'video-' + menuType + '-list');
                }
                if (info.audio.length >= 1) {
                    el.appendChild(this.createMediaTypeMenu('audio'));
                    el = this.createMenuContent(el, this.getMenuContent(menuType, info.audio, contentFunc), 'audio', 'audio-' + menuType + '-list');
                    this.setMenuItemsState(this.getMenuInitialIndex(info.audio, menuType, 'audio'), 'audio-' + menuType + '-list');
                }
                if (info.images && info.images.length >= 1) {
                    el.appendChild(this.createMediaTypeMenu('image'));
                    el = this.createMenuContent(el, this.getMenuContent(menuType, info.images, contentFunc, false), 'image', 'image-' + menuType + '-list');
                    this.setMenuItemsState(this.getMenuInitialIndex(info.images, menuType, 'image'), 'image-' + menuType + '-list');
                }
                break;
        }

        window.addEventListener('resize', this.handleMenuPositionOnResize, true);
        return el;
    };

    getMenuInitialIndex(info, menuType, mediaType) {
        if (menuType === 'track') {
            let mediaInfo = this.player.getCurrentTrackFor(mediaType);
            let idx = 0;
            info.some((element, index) => {
                if (this.isTracksEqual(element, mediaInfo)) {
                    idx = index;
                    return true;
                }
            });
            return idx;

        } else if (menuType === 'bitrate') {
            let cfg = this.player.getSettings();
            if (cfg.streaming && cfg.streaming.abr && cfg.streaming.abr.initialBitrate) {
                return cfg.streaming.abr.initialBitrate['mediaType'] | 0;
            }
            return 0;
        } else if (menuType === 'caption') {
            return this.player.getCurrentTextTrackIndex() + 1;
        }
    };

    isTracksEqual(t1, t2) {
        let sameId = t1.id === t2.id;
        let sameViewpoint = t1.viewpoint === t2.viewpoint;
        let sameLang = t1.lang === t2.lang;
        let sameRoles = t1.roles.toString() === t2.roles.toString();
        let sameAccessibility = (!t1.accessibility && !t2.accessibility) || (t1.accessibility && t2.accessibility && t1.accessibility.toString() === t2.accessibility.toString());
        let sameAudioChannelConfiguration = (!t1.audioChannelConfiguration && !t2.audioChannelConfiguration) || (t1.audioChannelConfiguration && t2.audioChannelConfiguration && t1.audioChannelConfiguration.toString() === t2.audioChannelConfiguration.toString());

        return (sameId && sameViewpoint && sameLang && sameRoles && sameAccessibility && sameAudioChannelConfiguration);
    };

    getMenuContent(type, arr, contentFunc, autoswitch) {
        autoswitch = (autoswitch !== undefined) ? autoswitch : true;

        let content = [];
        arr.forEach(function (element, index) {
            content.push(contentFunc(element, index));
        });
        if (type !== 'track' && autoswitch) {
            content.unshift(contentFunc(null, NaN));
        }
        return content;
    };

    getBrowserLocale() {
        return (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
    };

    getLabelForLocale(labels) {
        let locales = this.getBrowserLocale();

        for (let i = 0; i < labels.length; i++) {
            for (let j = 0; j < locales.length; j++) {
                if (labels[i].lang && locales[j] && locales[j].indexOf(labels[i].lang) > -1) {
                    return labels[i].text;
                }
            }
        }

        return labels.length === 1 ? labels[0].text : null;
    };

    createMediaTypeMenu(type) {
        let div = document.createElement('div');
        let title = document.createElement('div');
        let content = document.createElement('ul');

        div.id = type;

        title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        title.classList.add('menu-sub-menu-title');

        content.id = type + 'Content';
        content.classList.add(type + '-menu-content');

        div.appendChild(title);
        div.appendChild(content);

        return div;
    };

    createMenuContent(menu, arr, mediaType, name) {
        for (let i = 0; i < arr.length; i++) {
            let item = document.createElement('li');
            item.id = name + 'Item_' + i;
            item.index = i;
            item.mediaType = mediaType;
            item.name = name;
            item.selected = false;
            if (this.isObject(arr[i])) {
                // text tracks need extra properties
                item.mode = arr[i].mode;
                item.textContent = arr[i].text;
            } else {
                // Other tracks will just have their text
                item.textContent = arr[i];
            }

            item.onmouseover = function (/*e*/) {
                if (this.selected !== true) {
                    this.classList.add('menu-item-over');
                }
            };
            item.onmouseout = function (/*e*/) {
                this.classList.remove('menu-item-over');
            };
            item.onclick = (value, type) => { this.setMenuItemsState(value, type, item) };

            let el;
            if (mediaType === 'caption') {
                el = menu.querySelector('ul');
            } else {
                el = menu.querySelector('.' + mediaType + '-menu-content');
            }

            if (mediaType === 'caption') {
                if (item.mode !== 'disabled') {
                    el.appendChild(item);
                }
            } else {
                el.appendChild(item);
            }
        }

        return menu;
    };

    onMenuClick = (menu, btn) => {
        if (menu.classList.contains('hide')) {
            menu.classList.remove('hide');
            menu.onmouseleave = function (/*e*/) {
                this.classList.add('hide');
            };
        } else {
            menu.classList.add('hide');
        }
        menu.style.position = this.isFullscreen() ? 'fixed' : 'absolute';
        this.positionMenu(menu, btn);
    };

    setMenuItemsState = (value, type, obj) => {
        try {
            let item = typeof value === 'number' ? document.getElementById(type + 'Item_' + value) : obj;
            if (item) {
                let nodes = item.parentElement.children;

                for (let i = 0; i < nodes.length; i++) {
                    nodes[i].selected = false;
                    nodes[i].classList.remove('menu-item-selected');
                    nodes[i].classList.add('menu-item-unselected');
                }
                item.selected = true;
                item.classList.remove('menu-item-over');
                item.classList.remove('menu-item-unselected');
                item.classList.add('menu-item-selected');
                if (type === undefined) { // User clicked so type is part of item binding.
                    switch (item.name) {
                        case 'video-bitrate-list':
                        case 'audio-bitrate-list':
                            let cfg = {
                                'streaming': {
                                    'abr': {
                                        'autoSwitchBitrate': {}
                                    }
                                }
                            };

                            if (item.index > 0) {
                                cfg.streaming.abr.autoSwitchBitrate[item.mediaType] = false;
                                this.player.updateSettings(cfg);
                                this.player.setRepresentationForTypeByIndex(item.mediaType, item.index - 1, this.forceQuality);
                            } else {
                                cfg.streaming.abr.autoSwitchBitrate[item.mediaType] = true;
                                this.player.updateSettings(cfg);
                            }
                            break;
                        case 'image-bitrate-list':
                            this.player.setRepresentationForTypeByIndex(item.mediaType, item.index);
                            break;
                        case 'caption-list':
                            this.player.setTextTrack(item.index - 1);
                            break;
                        case 'video-track-list':
                        case 'audio-track-list':
                            this.player.setCurrentTrack(this.player.getTracksFor(item.mediaType)[item.index]);
                            break;
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    handleMenuPositionOnResize = () => {
        if (this.captionMenu) {
            this.positionMenu(this.captionMenu, this.captionBtn);
        }
        if (this.bitrateListMenu) {
            this.positionMenu(this.bitrateListMenu, this.bitrateListBtn);
        }
        if (this.trackSwitchMenu) {
            this.positionMenu(this.trackSwitchMenu, this.trackSwitchBtn);
        }
    };

    positionMenu(menu, btn) {
        if (btn.offsetLeft + menu.clientWidth >= this.videoController.clientWidth) {
            menu.style.right = '0px';
            menu.style.left = '';
        } else {
            menu.style.left = btn.offsetLeft + 'px';
        }
        let menu_y = this.videoController.offsetTop - menu.offsetHeight;
        menu.style.top = menu_y + 'px';
    };

    destroyMenu(menu, btn, handler) {
        try {
            if (menu && this.videoController) {
                btn.removeEventListener('click', handler);
                this.videoController.removeChild(menu);
            }
        } catch (e) {
        }
    };

    removeMenu(menu, btn) {
        try {
            if (menu) {
                this.videoController.removeChild(menu);
                menu = null;
                btn.classList.add('hide');
            }
        } catch (e) {
        }
    };

    //************************************************************************************
    //IE FIX
    //************************************************************************************

    coerceIEInputAndChangeEvents(slider, addChange) {
        let fireChange = () => {
            let changeEvent = document.createEvent('Event');
            changeEvent.initEvent('change', true, true);
            changeEvent.forceChange = true;
            slider.dispatchEvent(changeEvent);
        };

        this.addEventListener('change', (e) => {
            let inputEvent;
            if (!e.forceChange && e.target.getAttribute('type') === 'range') {
                e.stopPropagation();
                inputEvent = document.createEvent('Event');
                inputEvent.initEvent('input', true, true);
                e.target.dispatchEvent(inputEvent);
                if (addChange) {
                    e.target.removeEventListener('mouseup', fireChange);//TODO can not clean up this event on destroy. refactor needed!
                    e.target.addEventListener('mouseup', fireChange);
                }
            }

        }, true);
    };

    isIE() {
        return !!navigator.userAgent.match(/Trident.*rv[ :]*11\./);
    };

    //************************************************************************************
    //Utilities
    //************************************************************************************

    isObject(obj) {
        return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
    }

    //************************************************************************************
    // PUBLIC API
    //************************************************************************************

    initialize(suffix) {

        if (!this.player) {
            throw new Error('Please pass an instance of MediaPlayer.js when instantiating the ControlBar Object');
        }
        this.video = this.player.getVideoElement();
        if (!this.video) {
            throw new Error('Please call initialize after you have called attachView on MediaPlayer.js');
        }

        this.displayUTCTimeCodes = this.displayUTCTimeCodes === undefined ? false : this.displayUTCTimeCodes;

        this.initControls(suffix);
        this.video.controls = false;
        this.videoContainer = this.video.parentNode;
        this.captionBtn.classList.add('hide');
        if (this.trackSwitchBtn) {
            this.trackSwitchBtn.classList.add('hide');
        }
        this.addPlayerEventsListeners();
        this.playPauseBtn.addEventListener('click', this._onPlayPauseClick);
        this.muteBtn.addEventListener('click', this.onMuteClick);
        this.fullscreenBtn.addEventListener('click', this.onFullscreenClick);
        this.seekbar.addEventListener('pointerdown', this.onSeeking, true);
        this.seekbar.addEventListener('pointermove', this.onSeekBarMouseMove, {passive: true});
        // set passive to true for scroll blocking listeners (https://www.chromestatus.com/feature/5745543795965952)
        this.seekbar.addEventListener('pointerout', this.onSeekBarMouseMoveOut, true);
        this.seekbar.addEventListener('touchcancel', this.onSeekBarMouseMoveOut, true);
        this.seekbar.addEventListener('touchend', this.onSeekBarMouseMoveOut, true);
        this.volumebar.addEventListener('input', this.setVolume, true);
        document.addEventListener('fullscreenchange', this.onFullScreenChange, false);
        document.addEventListener('MSFullscreenChange', this.onFullScreenChange, false);
        document.addEventListener('mozfullscreenchange', this.onFullScreenChange, false);
        document.addEventListener('webkitfullscreenchange', this.onFullScreenChange, false);

        //IE 11 Input Fix.
        if (this.isIE()) {
            this.coerceIEInputAndChangeEvents(this.seekbar, true);
            this.coerceIEInputAndChangeEvents(this.volumebar, false);
        }

    }

    show() {
        this.videoController.classList.remove('hide');
    }

    hide() {
        this.videoController.classList.add('hide');
    }

    disable() {
        this.videoController.classList.add('disable');
    }

    enable() {
        this.videoController.classList.remove('disable');
    }

    forceQualitySwitch(value) {
        this.forceQuality = value;
    }

    resetSelectionMenus() {
        if (this.menuHandlersList.bitrate) {
            this.bitrateListBtn.removeEventListener('click', this.menuHandlersList.bitrate);
        }
        if (this.menuHandlersList.track) {
            this.trackSwitchBtn.removeEventListener('click', this.menuHandlersList.track);
        }
        if (this.menuHandlersList.caption) {
            this.captionBtn.removeEventListener('click', this.menuHandlersList.caption);
            this.nativeTextTracks.removeEventListener('change', this._onTracksChanged);
        }
        if (this.captionMenu) {
            this.removeMenu(this.captionMenu, this.captionBtn);
        }
        if (this.trackSwitchMenu) {
            this.removeMenu(this.trackSwitchMenu, this.trackSwitchBtn);
        }
        if (this.bitrateListMenu) {
            this.removeMenu(this.bitrateListMenu, this.bitrateListBtn);
        }
    }

    reset() {
        window.removeEventListener('resize', this.handleMenuPositionOnResize);

        this.resetSelectionMenus();

        this.menuHandlersList = [];
        this.seeking = false;

        if (this.seekbarPlay) {
            this.seekbarPlay.style.width = '0%';
        }

        if (this.seekbarBuffer) {
            this.seekbarBuffer.style.width = '0%';
        }
    }

    destroy() {
        this.reset();

        this.playPauseBtn.removeEventListener('click', this._onPlayPauseClick);
        this.muteBtn.removeEventListener('click', this.onMuteClick);
        this.fullscreenBtn.removeEventListener('click', this.onFullscreenClick);
        this.seekbar.removeEventListener('pointerdown', this.onSeeking);
        this.volumebar.removeEventListener('input', this.setVolume);
        this.seekbar.removeEventListener('mousemove', this.onSeekBarMouseMove);
        this.seekbar.removeEventListener('touchmove', this.onSeekBarMouseMove);
        this.seekbar.removeEventListener('mouseout', this.onSeekBarMouseMoveOut);
        this.seekbar.removeEventListener('touchcancel', this.onSeekBarMouseMoveOut);
        this.seekbar.removeEventListener('touchend', this.onSeekBarMouseMoveOut);

        this.removePlayerEventsListeners();

        document.removeEventListener('fullscreenchange', this.onFullScreenChange);
        document.removeEventListener('MSFullscreenChange', this.onFullScreenChange);
        document.removeEventListener('mozfullscreenchange', this.onFullScreenChange);
        document.removeEventListener('webkitfullscreenchange', this.onFullScreenChange);
    }
}


export {ControlBar}