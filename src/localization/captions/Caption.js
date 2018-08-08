/**
 * @export
 * @class Caption
 */
export class Caption {
  /**
   * Creates an instance of Caption.
   * @param {TimedLine[]} lines - Array of lines to be used for caption.
   * @memberof Caption
   */
  constructor(lines) {
    this.lines = lines;

    // Sort by end time, this ensures proper execution order of lines.
    this.lines.sort(function(a, b) {
      if (a.endTime < b.endTime) {
        return -1;
      }

      if (a.endTime > b.endTime) {
        return 1;
      }

      return 0;
    });

    this.reset();
  }

  /**
   * Resets time, lineIndex and content fields.
   * @private
   * @memberof Caption
   */
  reset() {
    this.time = 0;
    this.lineIndex = 0;
    this.beginCallback = null;
    this.endCallback = null;
  }

  /**
   * Updates content based on time passed.
   * This ~should~ be called every frame that the caption is active.
   *
   * @param {Number} deltaTime - Time in seconds since last frame.
   * @memberof Caption
   */
  update(deltaTime) {
    const time = this.time + deltaTime * 1000;
    if (time === this.time) {
      return;
    }

    this.updateState(time, this.time);
    this.time = time;
  }

  /**
   * Handles calling callbacks and updating caption's current state.
   * @param  {Number} currentTime
   * @param  {Number} lastTime
   * @memberof Caption
   */
  updateState(currentTime, lastTime) {
    if (this.isFinished()) {
      return;
    }

    if (currentTime > this.lines[this.lineIndex].endTime) {
      this.endCallback();
    }

    while (currentTime > this.lines[this.lineIndex].endTime) {
      this.lineIndex++;
      if (this.isFinished()) {
        return;
      }
    }

    const line = this.lines[this.lineIndex];
    if (currentTime >= line.startTime && lastTime < line.startTime) {
      this.beginCallback(line);
      return;
    }
  }

  /**
   * Checks if caption has completed.
   * @returns {Boolean}
   * @memberof Caption
   */
  isFinished() {
    return this.lineIndex >= this.lines.length;
  }

  /**
   * Sets time and line index of caption.
   *
   * @param {Number} [time=0] - Time in milliseconds.
   * @memberof Caption
   */
  start(time = 0, beginCallback = () => {}, endCallback = () => {}) {
    this.reset();
    this.beginCallback = beginCallback;
    this.endCallback = endCallback;
    this.time = time;

    // Initialize to the correct line index
    while (this.time > this.lines[this.lineIndex].endTime) {
      this.lineIndex++;
      if (this.isFinished()) {
        return;
      }
    }
    this.updateState(this.time, this.time - 1);
  }
}
