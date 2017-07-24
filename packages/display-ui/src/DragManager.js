import DragData from './DragData';
import {Application, include} from '@springroll/core';

/**
 * Drag manager is responsible for handling the dragging of stage elements
 * supports click-n-stick and click-n-drag functionality.
 * ### module: @springroll/display-ui
 *
 * @class
 * @memberof springroll
 */
export default class DragManager {
    /**
     * @param {springroll.Display} display The display that this DragManager is handling objects on.
     *                              Optionally, this parameter can be omitted and the Application's
     *                              default display will be used.
     * @param {function} startCallback The callback when when starting
     * @param {function} endCallback The callback when ending
     */
    constructor(display, startCallback, endCallback) {
        if (typeof display === 'function' && !endCallback) {
            endCallback = startCallback;
            startCallback = display;
            display = Application.instance.display;
        }

        /**
         * The object that's being dragged, or a dictionary of DragData being dragged
         * by id if multitouch is true.
         * @readOnly
         * @member {PIXI.DisplayObject|Dictionary}
         */
        this.draggedObj = null;

        /**
         * The radius in pixel to allow for dragging, or else does sticky click
         * @property dragStartThreshold
         * @default 20
         */
        this.dragStartThreshold = 20;

        /**
         * The position x, y of the mouse down on the stage. This is only used
         * when multitouch is false - the DragData has it when multitouch is true.
         * @private
         * @member {PIXI.Point}
         */
        this.mouseDownStagePos = new PIXI.Point(0, 0);

        /**
         * The position x, y of the object when interaction with it started. If multitouch is
         * true, then this will only be set during a drag stop callback, for the object that just
         * stopped getting dragged.
         * @member {PIXI.Point}
         */
        this.mouseDownObjPos = new PIXI.Point(0, 0);

        /**
         * If sticky click dragging is allowed.
         * @member {Bool}
         * @default true
         */
        this.allowStickyClick = true;

        /**
         * Is the move touch based
         * @readOnly
         * @member {Bool}
         * @default false
         */
        this.isTouchMove = false;

        /**
         * Is the drag being held on mouse down (not sticky clicking)
         * @readOnly
         * @member {Bool}
         * @default false
         */
        this.isHeldDrag = false;

        /**
         * Is the drag a sticky clicking (click on a item, then mouse the mouse)
         * @readOnly
         * @member {Bool}
         * @default false
         */
        this.isStickyClick = false;

        /**
         * Settings for snapping.
         *
         * Format for snapping to a list of points:
         *    {
         *        mode:"points",
         *        dist:20,//snap when within 20 pixels/units
         *        points:[
         *            { x: 20, y:30 },
         *            { x: 50, y:10 }
         *        ]
         *    }
         *
         * @member {object}
         * @default null
         */
        this.snapSettings = null;

        /**
         * Reference to the Pixi InteractionManager.
         * @private
         * @member {PIXI.interaction.InteractionManager}
         */
        this._interaction = display.renderer.plugins.interaction;

        /**
         * The offset from the dragged object's position that the initial mouse event
         * was at. This is only used when multitouch is false - the DragData has
         * it when multitouch is true.
         * @private
         * @member {PIXI.Point}
         */
        this._dragOffset = null;

        /**
         * External callback when we start dragging
         * @private
         * @member {function}
         */
        this._dragStartCallback = startCallback;

        /**
         * External callback when we are done dragging
         * @private
         * @member {function}
         */
        this._dragEndCallback = endCallback;

        this._triggerHeldDrag = this._triggerHeldDrag.bind(this);
        this._triggerStickyClick = this._triggerStickyClick.bind(this);
        this._stopDrag = this._stopDrag.bind(this);
        this._updateObjPosition = this._updateObjPosition.bind(this);

        /**
         * The collection of draggable objects
         * @private
         * @member {Array}
         */
        this._draggableObjects = [];

        /**
         * If this DragManager is using multitouch for dragging.
         * @private
         * @member {boolean}
         */
        this._multitouch = false;

        /**
         * If this DragManager has added drag listeners to the InteractionManager
         * @private
         * @member {boolean}
         */
        this._addedDragListeners = false;

        this.helperPoint = new PIXI.Point(0, 0);
    }

    /**
     * If the DragManager allows multitouch dragging. Setting this stops any current
     * drags.
     * @member {boolean}
     */
    get multitouch() {
        return this._multitouch;
    }
    set multitouch(value) {
        if (this.draggedObj) {
            if (this._multitouch) {
                for (let id in this.draggedObj) {
                    this._stopDrag(id, true);
                }
            }
            else {
                this._stopDrag(null, true);
            }
        }
        this._multitouch = !!value;
        this.draggedObj = value ? {} : null;
    }

    /**
     * Manually starts dragging an object. If a mouse down event is not supplied
     * as the second argument, it defaults to a held drag, that ends as soon as
     * the mouse is released. When using multitouch, passing a interaction data is
     * required.
     * @param {PIXI.DisplayObject} object The object that should be dragged.
     * @param {PIXI.InteractionData} interactionData The interaction data about
     *                                            the input event that triggered this.
     */
    startDrag(object, interactionData) {
        this._objMouseDown(object, interactionData);
    }

    /**
     * Mouse down on an object
     * @private
     * @param {PIXI.DisplayObject} object The object that should be dragged.
     * @param {PIXI.InteractionData} interactionData The interaction data about
     *                                            the input event that triggered this.
     */
    _objMouseDown(obj, interactionData) {
        //get the InteractionData we want from the Pixi v3 events
        if (interactionData.data && interactionData.data.global) {
            interactionData = interactionData.data;
        }
        // if we are dragging something, then ignore any mouse downs
        // until we release the currently dragged stuff
        if ((!this._multitouch && this.draggedObj) ||
            (this._multitouch && !interactionData)) {
            return;
        }

        let dragData, mouseDownObjPos, mouseDownStagePos, dragOffset;
        if (this._multitouch) {
            dragData = new DragData(obj);
            this.draggedObj[interactionData.identifier] = dragData;
            mouseDownObjPos = dragData.mouseDownObjPos;
            mouseDownStagePos = dragData.mouseDownStagePos;
            dragOffset = dragData.dragOffset;
        }
        else {
            this.draggedObj = obj;
            mouseDownObjPos = this.mouseDownObjPos;
            mouseDownStagePos = this.mouseDownStagePos;
            dragOffset = this._dragOffset = new PIXI.Point();
        }
        //Stop any tweens on the object (mostly the position)
        let Tween = include('createjs.Tween', false);
        if (Tween) {
            Tween.removeTweens(obj);
            Tween.removeTweens(obj.position);
        }

        if (obj._dragOffset) {
            dragOffset.x = obj._dragOffset.x;
            dragOffset.y = obj._dragOffset.y;
        }
        else {
            //get the mouse position and convert it to object parent space
            interactionData.getLocalPosition(obj.parent, dragOffset);

            //move the offset to respect the object's current position
            dragOffset.x -= obj.position.x;
            dragOffset.y -= obj.position.y;
        }

        mouseDownObjPos.x = obj.position.x;
        mouseDownObjPos.y = obj.position.y;

        //if we don't get an event (manual call neglected to pass one) then default to a held drag
        if (!interactionData) {
            this.isHeldDrag = true;
            this._startDrag();
        }
        else {
            mouseDownStagePos.x = interactionData.global.x;
            mouseDownStagePos.y = interactionData.global.y;
            //if it is a touch event, force it to be the held drag type
            if (!this.allowStickyClick || interactionData.originalEvent.type === 'touchstart') {
                this.isTouchMove = interactionData.originalEvent.type === 'touchstart';
                this.isHeldDrag = true;
                this._startDrag(interactionData);
            }
            //otherwise, wait for a movement or a mouse up in order to do a
            //held drag or a sticky click drag
            else {
                this._interaction.on('stagemove', this._triggerHeldDrag);
                this._interaction.on('stageup', this._triggerStickyClick);
            }
        }
    }

    /**
     * Start the sticky click
     * @param {PIXI.InteractionData} interactionData The interaction data about
     *                                            the input event that triggered this.
     * @private
     */
    _triggerStickyClick(interactionData) {
        //get the InteractionData we want from the Pixi v3 events
        interactionData = interactionData.data;
        this.isStickyClick = true;
        this._interaction.off('stagemove', this._triggerHeldDrag);
        this._interaction.off('stageup', this._triggerStickyClick);
        this._startDrag(interactionData);
    }

    /**
     * Start hold dragging
     * @private
     * @param {PIXI.InteractionData} interactionData The ineraction data about the moved mouse
     */
    _triggerHeldDrag(interactionData) {
        //get the InteractionData we want from the Pixi v3 events
        interactionData = interactionData.data;
        let mouseDownStagePos;
        if (this._multitouch) {
            mouseDownStagePos = this.draggedObj[interactionData.identifier].mouseDownStagePos;
        }
        else {
            mouseDownStagePos = this.mouseDownStagePos;
        }
        let xDiff = interactionData.global.x - mouseDownStagePos.x;
        let yDiff = interactionData.global.y - mouseDownStagePos.y;
        if (xDiff * xDiff + yDiff * yDiff >= this.dragStartThreshold * this.dragStartThreshold) {
            this.isHeldDrag = true;
            this._interaction.off('stagemove', this._triggerHeldDrag);
            this._interaction.off('stageup', this._triggerStickyClick);
            this._startDrag(interactionData);
        }
    }

    /**
     * Internal start dragging on the stage
     * @param {PIXI.InteractionData} interactionData The ineraction data about the moved mouse
     * @private
     */
    _startDrag(interactionData) {
        let draggedObj;
        if (this._multitouch) {
            draggedObj = this.draggedObj[interactionData.identifier].obj;
        }
        else {
            draggedObj = this.draggedObj;
        }

        this._updateObjPosition(
            {
                data: interactionData
            });

        if (!this._addedDragListeners) {
            this._addedDragListeners = true;
            this._interaction.on('stagemove', this._updateObjPosition);
            this._interaction.on('stageup', this._stopDrag);
        }

        this._dragStartCallback(draggedObj);
    }

    /**
     * Stops dragging the currently dragged object.
     * @param {Bool} [doCallback=false] If the drag end callback should be called.
     * @param {PIXI.DisplayObject} [obj] A specific object to stop dragging, if multitouch
     *                                   is true. If this is omitted, it stops all drags.
     */
    stopDrag(doCallback, obj) {
        let id = null;
        if (this._multitouch && obj) {
            for (let key in this.draggedObj) {
                if (this.draggedObj[key].obj === obj) {
                    id = key;
                    break;
                }
            }
        }
        //pass true if it was explicitly passed to us, false and undefined -> false
        this._stopDrag(id, doCallback === true);
    }

    /**
     * Internal stop dragging on the stage
     * @private
     * @param {PIXI.InteractionData} interactionData The ineraction data about the moved mouse
     * @param {Bool} doCallback If we should do the callback
     */
    _stopDrag(interactionData, doCallback) {
        let obj, id = null;
        //if touch id was passed directly
        if (typeof interactionData === 'number') {
            id = interactionData;
        }
        else if (interactionData) {
            //get the InteractionData we want from the Pixi v3 events
            if (interactionData.data && interactionData.data.global) {
                id = interactionData.data.identifier;
            }
            else if (interactionData instanceof PIXI.interaction.InteractionData) {
                id = interactionData.identifier;
            }
        }
        if (this._multitouch) {
            if (id !== null) {
                //stop a specific drag
                let data = this.draggedObj[id];
                if (!data) {
                    return;
                }
                obj = data.obj;
                //save the position that it started at so the callback can make use of it
                //if they want
                this.mouseDownObjPos.x = data.mouseDownObjPos.x;
                this.mouseDownObjPos.y = data.mouseDownObjPos.y;
                delete this.draggedObj[id];
            }
            else {
                //stop all drags
                for (id in this.draggedObj) {
                    this._stopDrag(id, doCallback);
                }
                return;
            }
        }
        else {
            obj = this.draggedObj;
            this.draggedObj = null;
        }

        if (!obj) {
            return;
        }

        let removeGlobalListeners = !this._multitouch;
        if (this._multitouch) {
            //determine if this was the last drag
            let found = false;
            for (id in this.draggedObj) {
                found = true;
                break;
            }
            removeGlobalListeners = !found;
        }
        if (removeGlobalListeners && this._addedDragListeners) {
            this._addedDragListeners = false;
            this._interaction.off('stagemove', this._updateObjPosition);
            this._interaction.off('stageup', this._stopDrag);
        }

        this.isTouchMove = false;
        this.isStickyClick = false;
        this.isHeldMove = false;

        if (doCallback !== false) {
            this._dragEndCallback(obj);
        }
    }

    /**
     * Update the object position based on the mouse
     * @private
     * @param {PIXI.InteractionData} interactionData Mouse move event
     */
    _updateObjPosition(interactionData) {
        //get the InteractionData we want from the Pixi v3 events
        interactionData = interactionData.data;

        //if(!this.isTouchMove && !this._theStage.interactionManager.mouseInStage) return;

        let draggedObj, dragOffset;
        if (this._multitouch) {
            let data = this.draggedObj[interactionData.identifier];
            draggedObj = data.obj;
            dragOffset = data.dragOffset;
        }
        else {
            draggedObj = this.draggedObj;
            dragOffset = this._dragOffset;
        }

        // not quite sure what chain of events would lead to this, but we'll stop dragging to be safe
        if (!draggedObj || !draggedObj.parent) {
            this.stopDrag(false, draggedObj);
            return;
        }

        let mousePos = interactionData.getLocalPosition(draggedObj.parent, this.helperPoint);
        let bounds = draggedObj._dragBounds;
        if (bounds) {
            draggedObj.position.x = Math.clamp(mousePos.x - dragOffset.x, bounds.x, bounds.right);
            draggedObj.position.y = Math.clamp(mousePos.y - dragOffset.y, bounds.y, bounds.bottom);
        }
        else {
            draggedObj.position.x = mousePos.x - dragOffset.x;
            draggedObj.position.y = mousePos.y - dragOffset.y;
        }
        if (this.snapSettings) {
            switch (this.snapSettings.mode) {
                case 'points':
                    this._handlePointSnap(mousePos, dragOffset, draggedObj);
                    break;
                case 'grid':
                    //not yet implemented
                    break;
                case 'line':
                    //not yet implemented
                    break;
            }
        }
    }

    /**
     * Handles snapping the dragged object to the nearest among a list of points
     * @private
     * @param {PIXI.Point} localMousePos The mouse position in the same space as the dragged object.
     * @param {PIXI.Point} dragOffset The drag offset for the dragged object.
     * @param {PIXI.DisplayObject} obj The object to snap.
     */
    _handlePointSnap(localMousePos, dragOffset) {
        let snapSettings = this.snapSettings;
        let minDistSq = snapSettings.dist * snapSettings.dist;
        let points = snapSettings.points;
        let objX = localMousePos.x - dragOffset.x;
        let objY = localMousePos.y - dragOffset.y;
        let leastDist = -1;
        let closestPoint = null;
        let draggedObj;
        for (let i = points.length - 1; i >= 0; --i) {
            let p = points[i];
            let distSq = Math.distSq(objX, objY, p.x, p.y);
            if (distSq <= minDistSq && (distSq < leastDist || leastDist === -1)) {
                leastDist = distSq;
                closestPoint = p;
            }
        }
        if (closestPoint) {
            draggedObj.position.x = closestPoint.x;
            draggedObj.position.y = closestPoint.y;
        }
    }

    //=== Giving functions and properties to draggable objects object

    
    /**
     * Adds properties and functions to the object - use enableDrag() and disableDrag() on
     * objects to enable/disable them (they start out disabled). Properties added to objects:
     * _dragBounds (Rectangle), _dragOffset (Point), _onMouseDownListener (Function),
     * _dragMan (springroll.DragManager) reference to the DragManager
     * these will override any existing properties of the same name
     * @param {PIXI.DisplayObject} obj The display object
     * @param {PIXI.Rectangle} [bounds] The rectangle bounds. 'right' and 'bottom' properties
     *                                  will be added to this object.
     * @param {PIXI.Point} [dragOffset] A specific drag offset to use each time, instead of
     *                                  the mousedown/touchstart position relative to the
     *                                  object. This is useful if you want something to always
     *                                  be dragged from a specific position, like the base of
     *                                  a torch.
     */
    addObject(obj, bounds, dragOffset) {
        if (bounds) {
            bounds.right = bounds.x + bounds.width;
            bounds.bottom = bounds.y + bounds.height;
        }
        obj._dragBounds = bounds;
        obj._dragOffset = dragOffset || null;
        if (this._draggableObjects.indexOf(obj) >= 0) {
            //don't change any of the functions or anything, just quit the function after having updated the bounds
            return;
        }

        obj.enableDrag = function() {
            this.on('touchstart', this._onMouseDownListener);
            this.on('mousedown', this._onMouseDownListener);
            this.buttonMode = this.interactive = true;
        };

        obj.disableDrag = function() {
            this.off('touchstart', this._onMouseDownListener);
            this.off('mousedown', this._onMouseDownListener);
            this.buttonMode = this.interactive = false;
        };

        obj._onMouseDownListener = function(mouseData) {
            this._dragMan._objMouseDown(this, mouseData);
        };

        obj._dragMan = this;
        this._draggableObjects.push(obj);
    }

    /**
     * Removes properties and functions added by addObject().
     * @param {PIXI.DisplayObject} obj The display object
     */
    removeObject(obj) {
        let index = this._draggableObjects.indexOf(obj);
        if (index >= 0) {
            obj.disableDrag();
            delete obj.enableDrag;
            delete obj.disableDrag;
            delete obj._onMouseDownListener;
            delete obj._dragMan;
            delete obj._dragBounds;
            delete obj._dragOffset;
            this._draggableObjects.splice(index, 1);
        }
    }

    /**
     * Destroy the manager
     */
    destroy() {
        //clean up dragged obj
        this.stopDrag(false);

        this._updateObjPosition = null;
        this._dragStartCallback = null;
        this._dragEndCallback = null;
        this._triggerHeldDrag = null;
        this._triggerStickyClick = null;
        this._stopDrag = null;
        this._interaction = null;
        for (let i = this._draggableObjects.length - 1; i >= 0; --i) {
            let obj = this._draggableObjects[i];
            obj.disableDrag();
            delete obj.enableDrag;
            delete obj.disableDrag;
            delete obj._onMouseDownListener;
            delete obj._dragMan;
            delete obj._dragBounds;
            delete obj._dragOffset;
        }
        this._draggableObjects = null;
    }
}
