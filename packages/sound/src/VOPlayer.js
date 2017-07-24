import Sound from './Sound';
import {Application, EventEmitter} from '@springroll/core';

/**
 * A class for managing audio by only playing one at a time, playing a list,
 * and even managing captions (Captions library) at the same time.
 * ### module: @springroll/sound
 * @class
 * @memberof springroll
 * @extends springroll.EventEmitter
 */
export default class VOPlayer extends EventEmitter {
    constructor() {
        super();

        //Bound method calls
        this._onSoundFinished = this._onSoundFinished.bind(this);
        this._updateSilence = this._updateSilence.bind(this);
        this._updateSoloCaption = this._updateSoloCaption.bind(this);
        this._syncCaptionToSound = this._syncCaptionToSound.bind(this);

        /**
         * An Array used when play() is called to avoid creating lots of Array objects.
         * @member {Array}
         * @private
         */
        this._listHelper = [];

        /**
         * If the VOPlayer should keep a list of all audio it plays for unloading
         * later. Default is false.
         * @member {boolean}
         */
        this.trackSound = false;

        /**
         * If the sound is currently paused. Setting this has no effect - use pause()
         * and resume().
         * @member {boolean}
         * @readOnly
         */
        this.paused = false;

        /**
         * The current list of audio/silence times/functions.
         * Generally you will not need to modify this.
         * @member {Array}
         */
        this.voList = null;

        /**
         * The current position in voList.
         * @member {number}
         * @private
         */
        this._listCounter = 0;

        /**
         * The current audio alias being played.
         * @member {string}
         * @private
         */
        this._currentVO = null;

        /**
         * The current audio instance being played.
         * @member {SoundInstance}
         * @private
         */
        this._soundInstance = null;

        /**
         * The callback for when the list is finished.
         * @member {function}
         * @private
         */
        this._callback = null;

        /**
         * The callback for when the list is interrupted for any reason.
         * @member {function}
         * @private
         */
        this._cancelledCallback = null;

        /**
         * A list of audio file played by this, so that they can be unloaded later.
         * @member {Array}
         * @private
         */
        this._trackedSounds = [];

        /**
         * A timer for silence entries in the list, in milliseconds.
         * @member {number}
         * @private
         */
        this._timer = 0;

        /**
         * The captions object
         * @member {springroll.Captions}
         * @private
         */
        this._captions = null;
    }

    /**
     * Fired when a new VO, caption, or silence timer begins
     * @event start
     * @param {string} currentVO The alias of the VO or caption that has begun, or null if it is
     *                           a silence timer.
     */

    /**
     * Fired when a new VO, caption, or silence timer completes
     * @event end
     * @param {string} currentVO The alias of the VO or caption that has begun, or null if it is
     *                           a silence timer.
     */

    /**
     * If VOPlayer is currently playing (audio or silence).
     * @member {boolean}
     * @readOnly
     */
    get playing() {
        return this._currentVO !== null || this._timer > 0;
    }

    /**
     * The current VO alias that is playing, even if it is just a caption. If a silence timer
     * is running, currentVO will be null.
     * @member {boolean}
     * @readOnly
     */
    get currentVO() {
        return this._currentVO;
    }

    /**
     * The springroll.Captions object used for captions. The developer is responsible
     * for initializing this with a captions dictionary config file and a reference
     * to a text field.
     * @member {springroll.Captions}
     */
    set captions(captions) {
        this._captions = captions;

        if (captions) {
            captions.selfUpdate = false;
        }
    }
    get captions() {
        return this._captions;
    }

    /**
     * The amount of time elapsed in the currently playing item of audio/silence in milliseconds
     * @member {number}
     */
    get currentPosition() {
        if (!this.playing) {
            return 0;
        }

        //active audio
        if (this._soundInstance) {
            return this._soundInstance.position;
        }
        //captions only
        else if (this._currentVO) {
            return this._timer;
        }
        //silence timer
        else {
            return this.voList[this._listCounter] - this._timer;
        }
    }

    /**
     * The duration of the currently playing item of audio/silence in milliseconds. If this is
     * waiting on an audio file to load for the first time, it will be 0, as there is no duration
     * data to give.
     * @member {number}
     */
    get currentDuration() {
        if (!this.playing) {
            return 0;
        }
        
        if (this._soundInstance) {
            //active audio
            return Sound.instance.getDuration(this._soundInstance.alias);
        }
        else if (this._currentVO && this._captions) {
            //captions only
            return this._captions.currentDuration;
        }
        else {
            //silence timer
            return this.voList[this._listCounter];
        }
    }

    /**
     * Calculates the amount of time elapsed in the current playlist of audio/silence.
     * @return {number} The elapsed time in milliseconds.
     */
    getElapsed() {
        let total = 0,
            item, i;

        if (!this.voList) {
            return 0;
        }

        for (i = 0; i < this._listCounter; ++i) {
            item = this.voList[i];
            if (typeof item === 'string') {
                total += Sound.instance.getDuration(item);
            }
            else if (typeof item === 'number') {
                total += item;
            }
        }
        //get the current item
        i = this._listCounter;

        if (i < this.voList.length) {
            item = this.voList[i];
            if (typeof item === 'string') {
                total += this._soundInstance.position;
            }
            else if (typeof item === 'number') {
                total += item - this._timer;
            }
        }

        return total;
    }

    /**
     * Pauses the current VO, caption, or silence timer if the VOPlayer is playing.
     */
    pause() {
        if (this.paused || !this.playing) {
            return;
        }

        this.paused = true;

        if (this._soundInstance) {
            this._soundInstance.pause();
        }

        //remove any update callback
        Application.instance.off('update', [
            this._updateSoloCaption,
            this._syncCaptionToSound,
            this._updateSilence
        ]);
    }

    /**
     * Resumes the current VO, caption, or silence timer if the VOPlayer was paused.
     */
    resume() {
        if (!this.paused) {
            return;
        }

        this.paused = false;

        if (this._soundInstance) {
            this._soundInstance.resume();
        }

        const app = Application.instance;

        //captions for solo captions or VO
        if (this._captions.playing) {
            if (this._soundInstance) {
                app.on('update', this._syncCaptionToSound);
            }
            else {
                app.on('update', this._updateSoloCaption);
            }
        }
        //timer
        else {
            app.on('update', this._updateSilence);
        }
    }

    /**
     * Plays a single audio alias, interrupting any current playback.
     * Alternatively, plays a list of audio files, timers, and/or functions.
     * Audio in the list will be preloaded to minimize pauses for loading.
     * @param {string|Array} idOrList The alias of the audio file to play or the
     * array of items to play/call in order.
     * @param {function} [callback] The function to call when playback is complete.
     * @param {function|boolean} [cancelledCallback] The function to call when playback
     * is interrupted with a stop() or play() call. If this value is a boolean
     * <code>true</code> then callback will be used instead.
     */
    play(idOrList, callback, cancelledCallback) {
        this.stop();

        //Handle the case where a cancel callback starts
        //A new VO play. Inline VO call should take priority
        //over the cancelled callback VO play.
        if (this.playing) {
            this.stop();
        }

        this._listCounter = -1;

        if (typeof idOrList === 'string') {
            this._listHelper.length = 0;
            this._listHelper[0] = idOrList;
            this.voList = this._listHelper;
        }
        else {
            this.voList = idOrList;
        }

        this._callback = callback;
        this._cancelledCallback = cancelledCallback === true ? callback : cancelledCallback;
        this._onSoundFinished();
    }

    /**
     * Callback for when audio/timer is finished to advance to the next item in the list.
     * @private
     */
    _onSoundFinished() {
        if (this._listCounter >= 0) {
            this.emit('end', this._currentVO);
        }

        //remove any update callback
        Application.instance.off('update', [
            this._updateSoloCaption,
            this._syncCaptionToSound,
            this._updateSilence
        ]);

        //if we have captions and an audio instance, set the caption time to the length of the audio
        if (this._captions && this._soundInstance) {
            this._captions.seek(this._soundInstance.length);
        }

        this._soundInstance = null; //clear the audio instance
        this._listCounter++; //advance list

        //if the list is complete
        if (this._listCounter >= this.voList.length) {
            if (this._captions) {
                this._captions.stop();
            }

            this._currentVO = null;
            this._cancelledCallback = null;

            let c = this._callback;
            this._callback = null;

            if (c) {
                c();
            }
        }
        else {
            this._currentVO = this.voList[this._listCounter];
            
            if (typeof this._currentVO === 'string') {
                //If the sound doesn't exist, then we play it and let it fail,
                //an error should be shown and playback will continue
                this._playSound();
                this.emit('start', this._currentVO);
            }
            else if (typeof this._currentVO === 'function') {
                this._currentVO(); //call function
                this._onSoundFinished(); //immediately continue
            }
            else {
                this._timer = this._currentVO; //set up a timer to wait
                this._currentVO = null;
                Application.instance.on('update', this._updateSilence);
                this.emit('start', null);
            }
        }
    }

    /**
     * The update callback used for silence timers.
     * This method is bound to the VOPlayer instance.
     * @private
     * @param {number} elapsed The time elapsed since the previous frame, in milliseconds.
     */
    _updateSilence(elapsed) {
        this._timer -= elapsed;

        if (this._timer <= 0) {
            this._onSoundFinished();
        }
    }

    /**
     * The update callback used for updating captions without active audio.
     * This method is bound to the VOPlayer instance.
     * @private
     * @param {number} elapsed The time elapsed since the previous frame, in milliseconds.
     */
    _updateSoloCaption(elapsed) {
        this._timer += elapsed;
        this._captions.seek(this._timer);

        if (this._timer >= this._captions.currentDuration) {
            this._onSoundFinished();
        }
    }

    /**
     * The update callback used for updating captions with active audio.
     * This method is bound to the VOPlayer instance.
     * @private
     * @param {number} elapsed The time elapsed since the previous frame, in milliseconds.
     */
    _syncCaptionToSound() {
        if (!this._soundInstance) {
            return;
        }

        this._captions.seek(this._soundInstance.position);
    }

    /**
     * Plays the current audio item and begins preloading the next item.
     * @private
     */
    _playSound() {
        // Only add a sound once
        if (this.trackSound && this._trackedSounds.indexOf(this._currentVO) === -1) {
            this._trackedSounds.push(this._currentVO);
        }
        let s = Sound.instance;
        if (!s.exists(this._currentVO) &&
            this._captions &&
            this._captions.hasCaption(this._currentVO)) {
            this._captions.play(this._currentVO);
            this._timer = 0;
            Application.instance.on('update', this._updateSoloCaption);
        }
        else {
            this._soundInstance = s.play(this._currentVO, this._onSoundFinished);
            if (this._captions) {
                this._captions.play(this._currentVO);
                Application.instance.on('update', this._syncCaptionToSound);
            }
        }
        let len = this.voList.length;
        let next;
        for (let i = this._listCounter + 1; i < len; ++i) {
            next = this.voList[i];
            if (typeof next === 'string') {
                if (s.exists(next) && !s.isLoaded(next)) {
                    s.preload(next);
                }
                break;
            }
        }
    }

    /**
     * Stops playback of any audio/timer.
     */
    stop() {
        this.paused = false;
        if (this._soundInstance) {
            this._soundInstance.stop();
            this._soundInstance = null;
        }
        this._currentVO = null;
        if (this._captions) {
            this._captions.stop();
        }
        Application.instance.off('update', [
            this._updateSoloCaption,
            this._syncCaptionToSound,
            this._updateSilence
        ]);
        this.voList = null;
        this._timer = 0;
        this._callback = null;

        let c = this._cancelledCallback;
        this._cancelledCallback = null;
        if (c) {
            c();
        }
    }

    /**
     * Unloads all audio this VOPlayer has played. If trackSound is false, this won't do anything.
     */
    unloadSound() {
        Sound.instance.unload(this._trackedSounds);
        this._trackedSounds.length = 0;
    }

    /**
     * Cleans up this VOPlayer.
     */
    destroy() {
        this.stop();
        this.voList = null;
        this._listHelper = null;
        this._currentVO = null;
        this._soundInstance = null;
        this._callback = null;
        this._cancelledCallback = null;
        this._trackedSounds = null;
        this._captions = null;
        super.destroy();
    }
}
