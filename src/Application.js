import StateManager from './state/StateManager';

/**
 * Main entry point for a game. Provides a single focal point for plugins and functionality to attach.
 * @class Application
 */
export class Application {
  /**
   * Creates a new application, setting up plugins along the way
   * @param {Object} features A configuration object denoting which features are enabled for this application
   * @param {Boolean} features.captions A boolean value denoting that this game supports captions
   * @param {Boolean} features.sound A boolean value denoting that this game has some audio in it
   * @param {Boolean} features.vo A boolean denoting that this game has mutable voice-over audio in it
   * @param {Boolean} features.music A boolean denoting that this game has mutable music in it
   * @param {Boolean} features.sfxButton A boolean denoting that this game has mutable sound effects in it
   */
  constructor(features = {}) {
    this.state = new StateManager();
    
    // built-in state for the application
    this.state.addField('ready', false);
    this.state.addField("soundMuted", false);
    this.state.addField("captionsMuted", true);
    this.state.addField("musicMuted", false);
    this.state.addField("voMuted", false);
    this.state.addField("sfxMuted", false);
    this.state.addField("pause", false);

    this.features = Object.assign({
      captions: false,
      sound: false,
      vo: false,
      music: false,
      sfxButton: false
    }, features);

    // always enable sound if one of the sound channels is enabled
    if(this.features.vo || this.features.music || this.features.sfxButton) {
      this.features.sound = true;
    }

    Application._plugins.forEach(plugin => plugin.setup.call(this));
    
    const preloads = Application._plugins.map(plugin => this.promisify(plugin.preload));
    Promise.all(preloads)
      .catch(e => {
        console.warn(e);
      })
      .then(() => {
        this.validateListeners();
      })
      .catch(e => {
        console.warn(e);
      })
      .then(() => {
        this.state.ready.value = true;
      });
  }

  /**
   * Converts a callback-based or synchronous function into a promise. This method is used for massaging plugin preload
   * methods before they are executed.
   * @param {Function} callback A function that takes either a callback, or returns a promise
   * @return Promise A promise that resolves when the function finishes executing (whether it is asynchronous or not)
   */
  promisify(callback) {
    // if it takes no argument, assume that it's synchronous or returns a Promise
    if(callback.length === 0) {
      return Promise.resolve(callback.call(this));
    }
    
    // if it has an argument, that means it uses a callback structure    
    return new Promise((resolve, reject) => {
      callback.call(this, function(error) {
        if(error) {
          reject(error);
        } else {
          resolve(error);
        }
      });
    });
  }

  /**
   * Validates that appropriate listeners are added for the features that were enabled in the constructor
   * @throws Error
   */
  validateListeners() {
    let missingListeners = [];

    let featureToStateMap = {
      captions: 'captionsMuted',
      sound: 'soundMuted',
      music: 'musicMuted',
      vo: 'voMuted',
      sfxButton: 'sfxMuted'
    };

    Object.keys(featureToStateMap).forEach(feature => {
      let stateName = featureToStateMap[feature];

      if(this.features[feature] && !this.state[stateName].hasListeners) {
        missingListeners.push(stateName);
      }
    });

    if(!this.state.pause.hasListeners) {
      missingListeners.push('pause');
    }

    if(missingListeners.length > 0) {
      throw new Error('Application state is missing required listeners: ' + missingListeners.join(', ') + '.');
    }
  }
}

/**
 * The list of plugins that are currently registered to run on Applications
 * @static
 */
Application._plugins = [];

/**
 * Registers a plugin to be used by applications, sorting it by priority order
 * @param {ApplicationPlugin} plugin The plugin to register
 */
Application.uses = function(plugin) {
  Application._plugins.push(plugin);
  Application._plugins.sort((p1, p2) => p2.priority - p1.priority);
};
