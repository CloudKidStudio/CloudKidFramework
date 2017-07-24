/**
 * A class for delaying a call through the Application, instead of relying on setInterval() or
 * setTimeout().
 * ### module: @springroll/core
 *
 * @class 
 * @memberof springroll
 */
export default class DelayedCall {
    /**
     * @param {springroll.Ticker} ticker Instance of ticker
     * @param {function} callback The function to call when the delay has completed.
     * @param {number} delay The time to delay the call, in milliseconds (or optionally frames).
     * @param {object|boolean} [options=false] The options to use or repeat value
     * @param {boolean} [options.repeat=false] If the DelayedCall should automatically repeat itself when
     *                              completed.
     * @param {boolean} [options.autoDestroy=true] If the DelayedCall should clean itself up when completed.
     * @param {boolean} [options.useFrames=false] If the DelayedCall should use frames instead of
     *                                 milliseconds for the delay.
     */
    constructor(ticker, callback, delay, options) {
        // Set the default options
        options = Object.assign({
            repeat: false,
            autoDestroy: true,
            useFrames: false
        }, options || {});

        /**
         * Update ticker
         * @member {springroll.Ticker}
         * @private
         */
        this._ticker = ticker;

        /**
         * The function to call when the delay is completed.
         * @private
         * @member {function}
         */
        this._callback = callback;

        /**
         * The delay time, in milliseconds.
         * @private
         * @member {number}
         */
        this._delay = delay;

        /**
         * The timer counting down from _delay, in milliseconds.
         * @private
         * @member {number}
         */
        this._timer = delay;

        /**
         * If the DelayedCall should repeat itself automatically.
         * @private
         * @member {boolean}
         * @default false
         */
        this._repeat = options.repeat;

        /**
         * If the DelayedCall should destroy itself after completing
         * @private
         * @member {boolean}
         * @default true
         */
        this._autoDestroy = options.autoDestroy;

        /**
         * If the DelayedCall should use frames instead of milliseconds for the delay.
         * @private
         * @member {boolean}
         * @default false
         */
        this._useFrames = options.useFrames;

        /**
         * If the DelayedCall is currently paused (not stopped).
         * @private
         * @member {boolean}
         */
        this._paused = false;

        //save a bound version of the update function
        this._update = this._update.bind(this);

        //start the delay
        this._ticker.on('update', this._update, this);
    }

    /**
     * The callback supplied to the Application for an update each frame.
     * @private
     * @method
     * @param {number} elapsed The time elapsed since the previous frame.
     */
    _update(elapsed) {
        if (!this._callback) {
            this.destroy();
            return;
        }

        this._timer -= this._useFrames ? 1 : elapsed;

        if (this._timer <= 0) {
            this._callback(this);

            if (this._repeat) {
                this._timer += this._delay;
            }
            else if (this._autoDestroy) {
                this.destroy();
            }
            else {
                this._ticker.off('update', this._update, this);
            }
        }
    }

    /**
     * Restarts the DelayedCall, whether it is running or not.
     */
    restart() {
        if (!this._callback) {
            return;
        }

        if (!this._ticker.has('update', this._update)) {
            this._ticker.on('update', this._update, this);
        }

        this._timer = this._delay;
        this._paused = false;
    }

    /**
     * Stops the DelayedCall, without destroying it.
     */
    stop() {
        this._ticker.off('update', this._update, this);
        this._paused = false;
    }

    /**
     * If the DelayedCall is paused or not.
     * @member {boolean}
     */
    get paused() {
        return this._paused;
    }
    set paused(value) {
        if (!this._callback) {
            return;
        }
        
        if (this._paused && !value) {
            this._paused = false;

            if (!this._ticker.has('update', this._update)) {
                this._ticker.on('update', this._update, this);
            }
        }
        else if (value) {
            if (this._ticker.has('update', this._update)) {
                this._paused = true;
                this._ticker.off('update', this._update, this);
            }
        }
    }

    /**
     * Stops and cleans up the DelayedCall. Do not use it after calling
     * destroy().
     */
    destroy() {
        this._ticker.off('update', this._update, this);
        this._callback = null;
        this._ticker = null;
    }
}
