import Task from './tasks/Task';
import {EventDispatcher} from '@springroll/core';

// @if DEBUG
import {Debug} from '@springroll/debug';
// @endif

/**
 * Class that represents a single multi load
 * @class AssetLoad
 * @private
 * @extends springroll.EventDispatcher
 * @constructor
 * @param {springroll.AssetManager} manager Reference to the manager
 */
export default class AssetLoad extends EventDispatcher
{
    constructor(manager)
    {
        super();

        /**
         * Reference to the Task Manager
         * @property {springroll.AssetManager} manager
         */
        this.manager = manager;

        // @if DEBUG
        this.id = AssetLoad.ID++;
        // @endif

        /**
         * How to display the results, either as single (0), map (1) or list (2)
         * @property {int} mode
         * @default 1
         */
        this.mode = MAP_MODE;

        /**
         * If we should run the tasks in parallel (true) or serial (false)
         * @property {Boolean} startAll
         * @default true
         */
        this.startAll = true;

        /**
         * If we should try to cache all items in the load
         * @property {Boolean} cacheAll
         * @default false
         */
        this.cacheAll = false;

        /**
         * The list of tasks to load
         * @property {Array} tasks
         */
        this.tasks = [];

        /**
         * The results to return when we're done
         * @property {Array|Object} results
         */
        this.results = null;

        /**
         * If the load is currently running
         * @property {Boolean} running
         * @default false
         */
        this.running = false;

        /**
         * The total number of assets loaded
         * @property {int} numLoaded
         * @default 0
         */
        this.numLoaded = 0;

        /**
         * The total number of assets
         * @property {int} total
         * @default 0
         */
        this.total = 0;

        /**
         * The default asset type if not defined
         * @property {String} type
         * @default null
         */
        this.type = null;
    }

    /**
     * When an asset is finished
     * @event taskDone
     * @param {*} result The loader result
     * @param {Object} originalAsset The original load asset
     * @param {Array} assets Collection to add additional assets to
     */

    /**
     * When all assets have been completed loaded
     * @event complete
     * @param {Array|Object} results The results of load
     */

    /**
     * Check how many assets have finished loaded
     * @event progress
     * @param {Number} percentage The amount loaded from 0 to 1
     */

    // @if DEBUG
    /**
     * Debugging purposes
     * @method toString
     */
    toString()
    {
        return `[AssetLoad (index: "${this.id}")]`;
    }
    // @endif

    /**
     * Initialize the Load
     * @method setup
     * @param {Object|Array} assets The collection of assets to load
     * @param {Object} [options] The loading options
     * @param {Boolean} [options.startAll=true] If we should run the tasks in order
     * @param {Boolean} [options.autoStart=true] Automatically start running
     * @param {Boolean} [options.cacheAll=false] If we should run the tasks in order
     * @param {String} [options.type] The default asset type of load, gets attached to each asset
     */
    setup(assets, options)
    {
        // Save options to load
        this.startAll = options.startAll;
        this.cacheAll = options.cacheAll;
        this.type = options.type;

        // Update the results mode and tasks
        this.mode = this.addTasks(assets);

        // Set the default container for the results
        this.results = this._getAssetsContainer(this.mode);

        // Start running
        if (options.autoStart)
        {
            this.start();
        }
    }

    /**
     * Start the load process
     * @method start
     */
    start()
    {
        // Empty load percentage
        this.trigger('progress', 0);

        // Keep track if we're currently running
        this.running = true;
        this.nextTask();
    }

    /**
     * Set back to the original state
     * @method reset
     */
    reset()
    {
        // Cancel any tasks
        this.tasks.forEach(function(task)
        {
            task.status = Task.FINISHED;
            task.destroy();
        });
        this.total = 0;
        this.numLoaded = 0;
        this.mode = MAP_MODE;
        this.tasks.length = 0;
        this.results = null;
        this.type = null;
        this.startAll = true;
        this.cacheAll = false;
        this.running = false;
    }

    /**
     * The result is a single result
     * @property {int} SINGLE_MODE
     * @private
     * @final
     * @static
     * @default 0
     */
    static get SINGLE_MODE()
    {
        return 0;
    }

    /**
     * The result is a map of result objects
     * @property {int} MAP_MODE
     * @private
     * @final
     * @static
     * @default 1
     */
    static get MAP_MODE()
    {
        return 1;
    }

    /**
     * The result is an array of result objects
     * @property {int} LIST_MODE
     * @private
     * @final
     * @static
     * @default 2
     */
    static get LIST_MODE()
    {
        return 2;
    }

    /**
     * Create a list of tasks from assets
     * @method  addTasks
     * @private
     * @param  {Object|Array} assets The assets to load
     */
    addTasks(assets)
    {
        var asset;
        var mode = AssetLoad.MAP_MODE;

        // Apply the defaults incase this is a single
        // thing that we're trying to load
        assets = this._applyDefaults(assets);

        // Check for a task definition on the asset
        // add default type for proper task recognition
        if (assets.type === undefined && this.type)
        {
            assets.type = this.type;
        }
        var isSingle = this.getTaskByAsset(assets);

        if (isSingle)
        {
            this.addTask(assets);
            return AssetLoad.SINGLE_MODE;
        }
        else
        {
            //if we added a default type for task recognition, remove it
            if (assets.type === this.type && this.type)
            {
                delete assets.type;
            }
            var task;
            if (Array.isArray(assets))
            {
                for (var i = 0; i < assets.length; i++)
                {
                    asset = this._applyDefaults(assets[i]);
                    task = this.addTask(asset);
                    if (!task.id)
                    {
                        // If we don't have the id to return
                        // a mapped result, we'll fallback to array results
                        mode = AssetLoad.LIST_MODE;
                    }
                }
            }
            else if (Object.isPlain(assets))
            {
                for (var id in assets)
                {
                    asset = this._applyDefaults(assets[id]);
                    task = this.addTask(asset);
                    if (!task.id)
                    {
                        task.id = id;
                    }
                }
            }
            else
            {
                // @if DEBUG
                Debug.error('Asset type unsupported', asset);
                // @endif
            }
        }
        return mode;
    }

    /**
     * Convert assets into object defaults
     * @method _applyDefaults
     * @private
     * @static
     * @param  {*} asset The function to convert
     * @return {Object} The object asset to use
     */
    _applyDefaults(asset)
    {
        // convert to a LoadTask
        if (typeof asset === 'string')
        {
            return {
                src: asset
            };
        }
        // convert to a FunctionTask
        else if (typeof asset === 'function')
        {
            return {
                async: asset
            };
        }
        return asset;
    }

    /**
     * Load a single asset
     * @method addTask
     * @private
     * @param {Object} asset The asset to load,
     *      can either be an object, URL/path, or async function.
     */
    addTask(asset)
    {
        if (asset.type === undefined && this.type)
        {
            asset.type = this.type;
        }
        var TaskClass = this.getTaskByAsset(asset);
        var task;
        if (TaskClass)
        {
            if (asset.cache === undefined && this.cacheAll)
            {
                asset.cache = true;
            }
            task = new TaskClass(asset);
            this.tasks.push(task);
            ++this.total;
        }
        else
        {
            // @if DEBUG
            Debug.error('Unable to find a task definition for asset', asset);
            // @endif
        }
        return task;
    }

    /**
     * Get the Task definition for an asset
     * @method  getTaskByAsset
     * @private
     * @static
     * @param  {Object} asset The asset to check
     * @return {Function} The Task class
     */
    getTaskByAsset(asset)
    {
        var TaskClass;
        var taskDefs = this.manager.taskDefs;

        // Loop backwards to get the registered tasks first
        // then will default to the basic Loader task
        for (var i = 0, len = taskDefs.length; i < len; i++)
        {
            TaskClass = taskDefs[i];
            if (TaskClass.test(asset))
            {
                return TaskClass;
            }
        }
        return null;
    }

    /**
     * Run the next task that's waiting
     * @method  nextTask
     * @private
     */
    nextTask()
    {
        var tasks = this.tasks;
        for (var i = 0; i < tasks.length; i++)
        {
            var task = tasks[i];
            if (task.status === Task.WAITING)
            {
                task.status = Task.RUNNING;
                task.start(this.taskDone.bind(this, task));

                // If we aren't running in parallel, then stop
                if (!this.startAll) return;
            }
        }
    }

    /**
     * Handler when a task has completed
     * @method  taskDone
     * @private
     * @param  {springroll.Task} task Reference to original task
     * @param  {*} [result] The result of load
     */
    taskDone(task, result)
    {
        // Ignore if we're destroyed
        if (!this.running) return;

        // Default to null
        result = result || null;

        var index = this.tasks.indexOf(task);

        // Task was already removed, because a clear
        if (index === -1)
        {
            return;
        }

        // Remove the completed task
        this.tasks.splice(index, 1);

        // Assets
        var assets = [];

        // Handle the file load tasks
        if (result)
        {
            // Handle the result
            switch (this.mode)
            {
                case AssetLoad.SINGLE_MODE:
                    this.results = result;
                    break;
                case AssetLoad.LIST_MODE:
                    this.results.push(result);
                    break;
                case AssetLoad.MAP_MODE:
                    this.results[task.id] = result;
                    break;
            }

            // Should we cache the task?
            if (task.cache)
            {
                this.manager.cache.write(task.id, result);
            }
        }

        // If the task has a complete method
        // we'll make sure that gets called
        // with a reference to the tasks
        // can potentially add more
        if (task.complete)
        {
            task.complete(result, task.original, assets);
        }

        // Asset is finished
        this.trigger('taskDone', result, task.original, assets);

        task.destroy();

        // Add new assets to the things to load
        var mode = this.addTasks(assets);

        // Update the progress total
        this.trigger('progress', ++this.numLoaded / this.total);

        // Check to make sure if we're in
        // map mode, we keep it that way
        if (this.mode === AssetLoad.MAP_MODE && mode !== this.mode)
        {
            // @if DEBUG
            Debug.error('Load assets require IDs to return mapped results', assets);
            return;
            // @endif

            // @if RELEASE
            // eslint-disable-next-line no-unreachable
            throw 'Assets require IDs';
            // @endif
        }

        if (this.tasks.length)
        {
            // Run the next task
            this.nextTask();
        }
        else
        {
            // We're finished!
            this.trigger('complete', this.results);
        }
    }

    /**
     * Get an empty assets collection
     * @method getAssetsContainer
     * @private
     * @param {int} mode The mode
     * @return {Array|Object|null} Empty container for assets
     */
    _getAssetsContainer(mode)
    {
        switch (mode)
        {
            case AssetLoad.SINGLE_MODE:
            {
                return null;
            }
            case AssetLoad.LIST_MODE:
            {
                return [];
            }
            case AssetLoad.MAP_MODE:
            {
                return {};
            }
        }
    }

    /**
     * Destroy this and discard
     * @method destroy
     */
    destroy()
    {
        super.destroy();
        this.reset();
        this.tasks = null;
        this.manager = null;
    }
}

// @if DEBUG
/**
 * Debugging Keep track of how many we've created
 * @property {int} ID
 * @static
 * @private
 */
AssetLoad.ID = 1;
// @endif
