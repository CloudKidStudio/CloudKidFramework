import ApplicationPlugin from '../../ApplicationPlugin';
import PersistentStorage from './PersistentStorage';
    
(function() {

    const plugin = new ApplicationPlugin('storage');

    // Init the animator
    plugin.setup = function() {
        /**
         * The data instance
         * @member {springroll.PersistentStorage} springroll.Application#data
         */
        this.storage = new PersistentStorage();
    };

    // Destroy the animator
    plugin.teardown = function() {
        this.data = null;
    };

}());