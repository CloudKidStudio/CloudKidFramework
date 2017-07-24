import {ApplicationPlugin} from '@springroll/core';
import Display from '../Display';

(function() {

    const plugin = new ApplicationPlugin('dom');

    // Establish the DOM elements for the display
    plugin.setup = function() {

        /**
         * The DOM element containing all SpringRoll elements.
         * ### module: @springroll/display
         * @member {HTMLElement} frameElement
         * @memberof springroll.Application#
         * @readonly
         */
        this.frameElement = getElement(
            Display.FRAME_ID,
            document.body
        );

        /**
         * The DOM element containing the display.
         * ### module: @springroll/display
         * @member {HTMLElement} displayElement
         * @memberof springroll.Application#
         * @readonly
         */
        this.displayElement = getElement(
            Display.DISPLAY_ID,
            this.frameElement
        );
    };

    function getElement(id, parent) {
        let element = document.getElementById(id);
        if (element) {
            return element;
        }
        element = document.createElement('div');
        element.id = id;
        element.dataset.autogenerated = true;
        parent.appendChild(element);
        return element;
    }

    // Only remove elements created by getElement
    // being a good citizen to the DOM
    function removeElement(element) {
        if (element.dataset.autogenerated) {
            element.parentNode.removeChild(element);
        }
    }

    // Cleanup elements
    plugin.teardown = function() {
        removeElement(this.frameElement);
        this.frameElement = null;
        removeElement(this.displayElement);
        this.displayElement = null;
    };

}());