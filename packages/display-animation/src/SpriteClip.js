/**
 * A class similar to PIXI.extras.AnimatedSprite, but made to play animations _exclusively_ using
 * the Animator, with data exported by the BitmapMovieClip exporter.
 *
 * Format for SpriteClip data (the same as BitmapMovieClip):
 * ```
 * {
 *     fps:30,
 *     labels:
 *     {
 *         animStart:0,
 *         animStart_loop:15
 *     },
 *     origin:{ x: 20, y:30 },
 *     frames:
 *     [
 *         {
 *             name:"myAnim#",
 *             min:1,
 *             max:20,
 *             digits:4
 *         }
 *     ],
 *     scale:1
 * }
 * ```
 * The example object describes a 30 fps animation that is 20 frames long, and was originally
 * myAnim0001.png->myAnim0020.png, with frame labels on the first and 16th frames. 'digits' is
 * optional, and defaults to 4.
 * ### module: @springroll/display-animation
 * @class
 * @extends PIXI.Sprite
 * @memberof springroll
 */
export default class SpriteClip extends PIXI.Sprite {
    /**
     * @param {object} [data] Initialization data
     * @param {number} [data.fps] Framerate to play the movieclip at. Omitting this will use the
     *                         current framerate.
     * @param {object} [data.labels] A dictionary of the labels in the movieclip to assist in
     *                               playing animations.
     * @param {object} [data.origin={x:0,y:0}] The origin of the movieclip.
     * @param {Array} [data.frames] An array of frame sequences to pull from the texture atlas.
     * @param {string} [data.frames.name] The name to use for the frame sequence. This should
     *                                    include a "#" to be replaced with the image number.
     * @param {number} [data.frames.min] The first frame number in the frame sequence.
     * @param {number} [data.frames.max] The last frame number in the frame sequence.
     * @param {number} [data.frames.digits=4] The maximum number of digits in the names of the frames,
     *                                     e.g. myAnim0001 has 4 digits.
     * @param {number} [data.scale=1] The scale at which the art was exported, e.g. a scale of 1.4
     *                                means the art was increased in size to 140% before exporting
     *                                and should be scaled back down before drawing to the screen.
     * @param {springroll.TextureAtlas} [atlas] A TextureAtlas to pull frames from. If omitted,
     *                                               frames are pulled from Pixi's global texture
     *                                               cache.
     */
    constructor(data, atlas) {
        super();

        //==== Public properties =====
        /**
         * The current frame of the movieclip.
         * @member currentFrame
         * @type Number
         * @default 0
         * @readonly
         */
        this.currentFrame = 0;

        //==== Private properties =====

        /**
         * The speed at which the SpriteClip should play.
         *
         * @member {number}
         * @default 0
         * @private
         */
        this._framerate = 0;

        /**
         * The total time in seconds for the animation.
         *
         * @member {number}
         * @default 0
         * @private
         */
        this._duration = 0;

        /**
         * The time elapsed from frame 0 in seconds.
         * @member {number}
         * @default 0
         * @private
         */
        this._t = 0;

        /**
         * An array of frame labels.
         * @member {Array}
         * @private
         */
        this._labels = 0;

        /**
         * An array of event labels.
         * @member {Array}
         * @private
         */
        this._events = 0;

        /**
         * The array of Textures that are the MovieClip's frames.
         * @member {Array}
         * @private
         */
        this._textures = null;

        if (data) {
            this.init(data, atlas);
        }
    }

    /**
     * The speed at which the SpriteClip should play.
     * @member {number}
     * @default 0
     */
    get framerate() {
        return this._framerate;
    }
    set framerate(value) {
        if (value > 0) {
            this._framerate = value;
            this._duration = value ? this._textures.length / value : 0;
        }
        else {
            this._framerate = this._duration = 0;
        }
    }

    /**
     * When the BitmapMovieClip is framerate independent, this is the time elapsed from frame 0 in
     * seconds.
     * @member {number}
     * @default 0
     */
    get elapsedTime() {
        return this._t;
    }
    set elapsedTime(value) {
        this._t = value;

        if (this._t > this._duration) {
            this._t = this._duration;
        }

        //add a tiny amount to stop floating point errors in their tracks
        this.currentFrame = Math.floor(this._t * this._framerate + 0.0000001);

        if (this.currentFrame >= this._textures.length) {
            this.currentFrame = this._textures.length - 1;
        }

        this.texture = this._textures[this.currentFrame] || PIXI.Texture.EMPTY;
    }

    /**
     * (Read-Only) The total number of frames in the timeline
     * @member {number}
     * @default 0
     * @readOnly
     */
    get totalFrames() {
        return this._textures.length;
    }

    //==== Public Methods =====

    /**
     * Advances this movie clip to the specified position or label.
     * @param {string$number} positionOrLabel The animation or frame name to go to.
     */
    gotoAndStop(positionOrLabel) {
        let pos = null;
        if (typeof positionOrLabel === 'string') {
            let labels = this._labels;
            for (let i = 0, len = labels.length; i < len; ++i) {
                if (labels[i].label === positionOrLabel) {
                    pos = labels[i].position;
                    break;
                }
            }
        }
        else {
            pos = positionOrLabel;
        }

        if (pos === null) {
            return;
        }

        if (pos >= this._textures.length) {
            pos = this._textures.length - 1;
        }

        this.currentFrame = pos;

        if (this._framerate > 0) {
            this._t = pos / this._framerate;
        }
        else {
            this._t = 0;
        }

        this.texture = this._textures[pos] || PIXI.Texture.EMPTY;
    }

    /**
     * Advances the playhead. This occurs automatically each tick by default.
     * @param [time] {number} The amount of time in milliseconds to advance by.
     */
    advance(time) {
        if (this._framerate > 0 && time) {
            this._t += time * 0.001; //milliseconds -> seconds
            if (this._t > this._duration) {
                this._t = this._duration;
            }
            //add a tiny amount to stop floating point errors in their tracks
            this.currentFrame = Math.floor(this._t * this._framerate + 0.0000001);

            if (this.currentFrame >= this._textures.length) {
                this.currentFrame = this._textures.length - 1;
            }

            this.texture = this._textures[this.currentFrame] || PIXI.Texture.EMPTY;
        }
    }

    /**
     * Returns a sorted list of the labels defined on this SpriteClip.
     * @return {Array<Object>} A sorted array of objects with label and position (aka frame)
     *                        properties.
     */
    getLabels() {
        return this._labels;
    }

    /**
     * Returns a sorted list of the labels which can be played with Animator.
     * @return {Array} A sorted array of objects with label, length and position (aka frame)
     *    properties.
     */
    getEvents() {
        return this._events;
    }

    /**
     * Returns the name of the label on or immediately before the current frame.
     * @return {string} The name of the current label or null if there is no label.
     */
    getCurrentLabel() {
        let labels = this._labels;
        let current = null;
        for (let i = 0, len = labels.length; i < len; ++i) {
            if (labels[i].position <= this.currentFrame) {
                current = labels[i].label;
            }
            else {
                break;
            }
        }
        return current;
    }

    /**
     * Initializes or re-initializes the SpriteClip.
     * @param {object} data Initialization data
     * @param {number} [data.fps] Framerate to play the movieclip at. Omitting this will use the
     *                         current framerate.
     * @param {object} [data.labels] A dictionary of the labels in the movieclip to assist in
     *                               playing animations.
     * @param {object} [data.origin={x:0,y:0}] The origin of the movieclip.
     * @param {Array} [data.frames] An array of frame sequences to pull from the texture atlas.
     * @param {string} [data.frames.name] The name to use for the frame sequence. This should
     *                                    include a "#" to be replaced with the image number.
     * @param {number} [data.frames.min] The first frame number in the frame sequence.
     * @param {number} [data.frames.max] The last frame number in the frame sequence.
     * @param {number} [data.frames.digits=4] The maximum number of digits in the names of the frames,
     *                                     e.g. myAnim0001 has 4 digits.
     * @param {number} [data.scale=1] The scale at which the art was exported, e.g. a scale of 1.4
     *                                means the art was increased in size to 140% before exporting
     *                                and should be scaled back down before drawing to the screen.
     * @param {springroll.pixi.TextureAtlas} [atlas] A TextureAtlas to pull frames from. If omitted,
     *                                               frames are pulled from Pixi's global texture
     *                                               cache.
     */
    init(data, atlas) {
        //collect the frame labels
        let labels = this._labels = [];
        let events = this._events = [];

        let name;
        if (data.labels) {
            let positions = {};

            for (name in data.labels) {
                let label = {
                    label: name,
                    position: data.labels[name],
                    length: 1
                };

                positions[name] = label.position;

                // Exclude animation-end tags
                if (!/_(loop|stop)$/.test(name)) {
                    events.push(label);
                }
                labels.push(label);
            }
            // Calculate the lengths for all the event labels
            let start = null;
            for (let j = 0; j < events.length; j++) {
                let event = events[j];
                start = event.position;
                event.length =
                    positions[name + '_stop'] - start ||
                    positions[name + '_loop'] - start ||
                    0;
            }
            labels.sort(this._labelSorter);
            events.sort(this._labelSorter);
        }

        //collect the frames
        this._textures = [];

        let index;
        for (let i = 0; i < data.frames.length; ++i) {
            let frameSet = data.frames[i];

            name = frameSet.name;
            index = name.lastIndexOf('/');
            //strip off any folder structure included in the name
            if (index >= 0) {
                name = name.substring(index + 1);
            }

            if (atlas) {
                atlas.getFrames(
                    name,
                    frameSet.min,
                    frameSet.max,
                    frameSet.digits,
                    this._textures
                );
            }
            else {
                this._getFrames(
                    name,
                    frameSet.min,
                    frameSet.max,
                    frameSet.digits,
                    this._textures
                );
            }
        }

        //set up the framerate
        if (data.fps) {
            this.framerate = data.fps;
        }
        else if (this._framerate) {
            this.framerate = this._framerate;
        }

        if (data.origin) {
            this.pivot.x = data.origin.x;
            this.pivot.y = data.origin.y;
        }
        else {
            this.pivot.x = this.pivot.y = 0;
        }

        this.gotoAndStop(0);
    }

    _labelSorter(a, b) {
        return a.position - b.position;
    }

    _getFrames(name, numberMin, numberMax, maxDigits, outArray) {
        if (maxDigits === undefined) {
            maxDigits = 4;
        }

        if (maxDigits < 0) {
            maxDigits = 0;
        }

        if (!outArray) {
            outArray = [];
        }

        //set up strings to add the correct number of zeros ahead of time to avoid creating even more strings.
        let zeros = []; //preceding zeroes array
        let compares = []; //powers of 10 array for determining how many preceding zeroes to use
        let i, c;
        for (i = 1; i < maxDigits; ++i) {
            let s = '';
            c = 1;
            for (let j = 0; j < i; ++j) {
                s += '0';
                c *= 10;
            }
            zeros.unshift(s);
            compares.push(c);
        }
        let compareLength = compares.length; //the length of the compare

        //the previous Texture, so we can place the same object in multiple times to control
        //animation rate
        let prevTex;
        let len;
        let fromFrame = PIXI.Texture.fromFrame;
        for (i = numberMin, len = numberMax; i <= len; ++i) {
            let num = null;
            //calculate the number of preceding zeroes needed, then create the full number string.
            for (c = 0; c < compareLength; ++c) {
                if (i < compares[c]) {
                    num = zeros[c] + i;
                    break;
                }
            }
            if (!num) {
                num = i.toString();
            }

            //If the texture doesn't exist, use the previous texture - this should allow us to use
            //fewer textures that are in fact the same, if those textures were removed before
            //making the spritesheet
            let texName = name.replace('#', num);
            let tex = fromFrame(texName, true);
            if (tex) {
                prevTex = tex;
            }

            if (prevTex) {
                outArray.push(prevTex);
            }
        }

        return outArray;
    }

    /**
     * Copies the labels, textures, origin, and framerate from another SpriteClip.
     * The labels and textures are copied by reference, instead of a deep copy.
     * @param {SpriteClip} other The movieclip to copy data from.
     */
    copyFrom(other) {
        this._textures = other._textures;
        this._labels = other._labels;
        this._events = other._events;
        this.pivot.x = other.pivot.x;
        this.pivot.y = other.pivot.y;
        this._framerate = other._framerate;
        this._duration = other._duration;
    }

    /**
     * Destroys the SpriteClip.
     */
    destroy(options) {
        this._labels = this._events = null;
        super.destroy(options);
    }
}
